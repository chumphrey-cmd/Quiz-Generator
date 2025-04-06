// Function to parse questions from text format into structured data
function parseQuestions(text) {
    const questions = [];
    console.log('Starting to parse text:', text.substring(0, 100));

    // Clean and normalize the input text
    // \r represents a carriage return character
    // \n represents a line feed (newline) character
    // /g is a global flag that means "replace all occurrences" in the text, not just the first match
    const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Split text into separate question blocks
    // Use + to handle multiple blank lines between questions
    const questionBlocks = cleanText.split(/\n\s*\n+/);
    console.log('Number of question blocks:', questionBlocks.length);

    questionBlocks.forEach((block, index) => {
        // Split each block into lines and clean whitespace
        const lines = block.trim().split('\n').map(line => line.trim());
        console.log(`Processing block ${index + 1}:`, lines);

        // Check if the first line exists before trying to match
        if (!lines[0]) return; // Skip empty blocks

        // Match the question pattern
        const questionMatch = lines[0].match(/^(\d+)\.\s*(.*)/);

        if (questionMatch) {
            // Extract question number and text
            const questionNumber = parseInt(questionMatch[1]);
            const questionText = questionMatch[2];
            const answers = [];
            // Changed variable name for clarity
            let correctAnswerLetter = null;
            // Index to track current line being processed for answers
            let lineIndex = 1;

            // Process answers (A, B, C, D, ...) dynamically
            // Using a while loop to handle variable number of answer lines.
            while (lineIndex < lines.length && lines[lineIndex]) { // Check if line exists and is not empty
                // [A-Z] to allow more answer options
                const answerMatch = lines[lineIndex].match(/^([A-Z])\.\s*(.*)/);

                if (answerMatch) {
                    const letter = answerMatch[1];
                    let text = answerMatch[2].trim();

                    // Check for correct answer marking
                    if (text.endsWith('*')) {
                        text = text.slice(0, -1).trim();
                        // Handle only storing the *first* correct answer found
                        if (correctAnswerLetter !== null) {
                            console.warn(`Multiple correct answers marked for question ${questionNumber}. Only the first one ('${correctAnswerLetter}') will be used.`);
                        } else {
                            correctAnswerLetter = letter;
                        }
                    }

                    answers.push({
                        letter: letter,
                        text: text
                    });
                } else {
                    // If the line doesn't start with an uppercase letter and period,
                    // assume it's not an answer and stop processing answers for this question.
                    break;
                }
                lineIndex++; // Move to the next line
            }

            // Requires at least 2 answer options (e.g., A, B) and one correct answer marker.
            if (answers.length >= 2 && correctAnswerLetter) {
                questions.push({
                    number: questionNumber, // Original number, will be renumbered after shuffle
                    text: questionText,
                    answers: answers,
                    correct: correctAnswerLetter // Store the letter of the correct answer
                });
            } else {
                 console.warn(`Skipping question ${questionNumber || (index + 1)} due to insufficient answers (${answers.length}) or no correct answer marked.`);
            }
        } else {
             console.warn(`Skipping block ${index + 1} as it doesn't start with a question number.`);
        }
    });

    console.log('Final parsed questions:', questions);
    return questions;
}

// Validation function to check question format and requirements
function validateQuestions(questions) {
    const errors = [];
    console.log('Starting validation of questions (variable answers):', questions);

    if (!Array.isArray(questions)) {
        errors.push("Input is not a valid array of questions.");
        return errors;
    }

    questions.forEach((question, index) => {
        // Check structure basics
        if (!question || typeof question !== 'object') {
            errors.push(`Item at index ${index} is not a valid question object.`);
            return; // Skip further checks for this item
        }
        if (typeof question.number !== 'number' || typeof question.text !== 'string' || !Array.isArray(question.answers) || typeof question.correct !== 'string') {
             errors.push(`Question ${question.number || (index + 1)} has missing or invalid properties.`);
             return;
        }


        // Check for at least two answers
        if (question.answers.length < 2) {
            errors.push(`Question ${question.number}: Must have at least two answer options.`);
        }

        // Check if the stored 'correct' letter exists in the parsed answers
        const correctLetterExists = question.answers.some(ans => ans.letter === question.correct);
        if (!correctLetterExists) {
             errors.push(`Question ${question.number}: The marked correct answer ('${question.correct}') does not correspond to any parsed answer options.`);
        }

        // Check answer letters sequence (A, B, C, ...)
        for (let i = 0; i < question.answers.length; i++) {
            const expectedLetter = String.fromCharCode(65 + i); // 65 is ASCII for 'A'
            if (!question.answers[i] || question.answers[i].letter !== expectedLetter) {
                errors.push(`Question ${question.number}: Answer lettering is not sequential (Expected ${expectedLetter}, check order/duplicates).`);
                break; // Stop checking sequence for this question once an error is found
            }
        }

    });

    console.log('Validation complete (variable answers). Errors:', errors);
    return errors;
}

// Function to process questions
function processQuestions(questionText) {
    const parsedQuestions = parseQuestions(questionText);
    console.log('Parsed Questions:', parsedQuestions);

    const validationErrors = validateQuestions(parsedQuestions);
    
    if (validationErrors.length === 0) {
        const htmlContent = displayQuestions(parsedQuestions);
        document.getElementById('quiz-content').innerHTML = htmlContent;
        return true; // Indicate success
    } else {
        console.error('Validation errors:', validationErrors);
        alert('Error in question format. Please check the file format.');
        return false;
    }
}