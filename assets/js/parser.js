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
        // console.log(`Processing block ${index + 1}:`, lines); // Keep if debugging needed

        // Check if the first line exists before trying to match
        if (!lines[0]) return; // Skip empty blocks

        // Match the question pattern
        const questionMatch = lines[0].match(/^(\d+)\.\s*(.*)/);

        if (questionMatch) {
            // Extract question number and text
            const questionNumber = parseInt(questionMatch[1]);
            const questionText = questionMatch[2];
            const answers = [];
            // << MODIFIED >>: Use an array to store multiple correct letters
            let correctAnswers = [];
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
                        // << MODIFIED >>: Add letter to the array
                        correctAnswers.push(letter);
                        // Removed warning about only taking the first correct answer
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

            // << MODIFIED >>: Check if correctAnswers array has at least one entry.
            if (answers.length >= 2 && correctAnswers.length > 0) {
                questions.push({
                    number: questionNumber, // Original number, will be renumbered after shuffle
                    text: questionText,
                    answers: answers,
                    // << MODIFIED >>: Store the array of correct letters
                    correct: correctAnswers
                });
            } else {
                 console.warn(`Skipping question ${questionNumber || (index + 1)} due to insufficient answers (${answers.length}) or no correct answer marked.`);
            }
        } else {
             console.warn(`Skipping block ${index + 1} as it doesn't start with a question number.`);
        }
    });

    console.log('Final parsed questions:', questions);
    return questions; // Return the array of question objects
}

// Validation function to check question format and requirements
function validateQuestions(questions) {
    const errors = [];
    // Changed console log slightly to reflect multi-answer support
    console.log('Starting validation of questions (multiple answers support):', questions);

    if (!Array.isArray(questions)) {
        errors.push("Input is not a valid array of questions.");
        return errors; // Return only errors array if input itself is wrong
    }

    questions.forEach((question, index) => {
        // Check structure basics
        if (!question || typeof question !== 'object') {
            errors.push(`Item at index ${index} is not a valid question object.`);
            return; // Skip further checks for this item
        }
        // << MODIFIED >>: Check if 'correct' is a non-empty array of strings
        if (typeof question.number !== 'number' ||
            typeof question.text !== 'string' ||
            !Array.isArray(question.answers) ||
            !Array.isArray(question.correct) || // Must be an array
            question.correct.length === 0 || // Must not be empty
            !question.correct.every(c => typeof c === 'string')) { // All elements must be strings
             errors.push(`Question ${question.number || (index + 1)} has missing or invalid properties (expecting 'correct' to be a non-empty array of strings).`);
             // Continue checks if possible
        }

        // Check for at least two answers
        if (question.answers.length < 2) {
            errors.push(`Question ${question.number}: Must have at least two answer options.`);
        }

        // << MODIFIED >>: Check if the stored 'correct' letters exist in the parsed answers
        // Only run this check if question.correct is a valid array (helps avoid errors)
        if (Array.isArray(question.correct) && question.correct.length > 0) {
            const answerLetters = question.answers.map(ans => ans.letter);
            // Find which correct letters provided don't exist in the answer options
            const invalidCorrectLetters = question.correct.filter(correctLetter => !answerLetters.includes(correctLetter));

            if (invalidCorrectLetters.length > 0) {
                 errors.push(`Question ${question.number}: The marked correct answer(s) ('${invalidCorrectLetters.join(', ')}') do not correspond to any parsed answer options.`);
            }
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

    // Adjusted console log
    console.log('Validation complete (multiple answers support). Errors:', errors);
    return errors; // Return the array of error messages (empty if no errors)
}

// Function to process questions
function processQuestions(questionText) {
    // Calls parseQuestions to get the structured data
    const parsedQuestions = parseQuestions(questionText);
    console.log('Parsed Questions:', parsedQuestions); // Log the result of parsing

    // Calls validateQuestions to check the structure
    const validationErrors = validateQuestions(parsedQuestions);

    // Checks if the validation returned any errors
    if (validationErrors.length === 0) {
        // Log success if needed (optional)
        // console.log("processQuestions: Validation successful.");
        // Ensure it returns the ARRAY of questions:
        return parsedQuestions; // Return the array (possibly empty) if validation passed
    } else {
        // Log errors if validation failed
        console.error('Validation errors:', validationErrors);
        // Prepare and show an error message to the user
        let errorMsg = 'Error in question format. Please check the file.\nDetails:\n';
        validationErrors.forEach(err => errorMsg += `- ${err}\n`);
        alert(errorMsg);
        // Optionally update the UI to show the error state
        const quizContentElement = document.getElementById('quiz-content');
         if(quizContentElement){
             quizContentElement.innerHTML = `<p style="color: red;">${errorMsg.replace(/\n/g, '<br>')}</p>`;
         }
        // Return null to indicate failure to the calling function (ExamManager)
        return null;
    }
}