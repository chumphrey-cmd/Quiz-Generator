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
    const questionBlocks = cleanText.split(/\n\s*\n/);
    console.log('Number of question blocks:', questionBlocks.length);
    
    questionBlocks.forEach((block, index) => {
        // Split each block into lines and clean whitespace
        const lines = block.trim().split('\n').map(line => line.trim());
        console.log(`Processing block ${index + 1}:`, lines);
        
        // Match the question pattern
        const questionMatch = lines[0].match(/^(\d+)\.\s*(.*)/);
        
        if (questionMatch) {
            // Extract question number and text
            const questionNumber = parseInt(questionMatch[1]);
            const questionText = questionMatch[2];
            const answers = [];
            let correctAnswer = null;
            
            // Process answers (A, B, C, D)
            for (let i = 1; i <= 4; i++) {
                if (lines[i]) {
                    const answerMatch = lines[i].match(/^([A-D])\.\s*(.*)/);
                    if (answerMatch) {
                        const letter = answerMatch[1];
                        let text = answerMatch[2].trim();
                        
                        // Check for correct answer marking
                        if (text.endsWith('*')) {
                            text = text.slice(0, -1).trim();
                            correctAnswer = letter;
                        }
                        
                        answers.push({
                            letter: letter,
                            text: text
                        });
                    }
                }
            }
            
            // Only add complete questions
            if (answers.length === 4 && correctAnswer) {
                questions.push({
                    number: questionNumber,
                    text: questionText,
                    answers: answers,
                    correct: correctAnswer
                });
            }
        }
    });
    
    console.log('Final parsed questions:', questions);
    return questions;
}

// Validation function to check question format and requirements
function validateQuestions(questions) {
    const errors = [];
    console.log('Starting validation of questions:', questions);
    
    questions.forEach(question => {
        // Check if answers array exists and has content
        if (!question.answers || !Array.isArray(question.answers)) {
            console.log('Invalid answers array for question:', question.number);
            errors.push(`Question ${question.number}: Invalid answers format`);
            return;
        }

        // Check for exactly four answers
        if (question.answers.length !== 4) {
            console.log('Answer count:', question.answers.length);
            errors.push(`Question ${question.number} does not have exactly four answers.`);
        }
        
        // Check for exactly one correct answer
        const correctAnswers = question.answers.filter(ans => ans.letter === question.correct);
        console.log('Correct answers found:', correctAnswers.length);
        if (correctAnswers.length !== 1) {
            errors.push(`Question ${question.number} does not have exactly one correct answer.`);
        }
        
        // Check answer letters sequence
        const expectedLetters = ['A', 'B', 'C', 'D'];
        question.answers.forEach((answer, index) => {
            if (answer.letter !== expectedLetters[index]) {
                errors.push(`Question ${question.number} has incorrect answer lettering.`);
            }
        });
    });
    
    console.log('Validation complete. Errors:', errors);
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