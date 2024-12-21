// Function to parse questions from text format into structured data
function parseQuestions(text) {
    const questions = [];
    
    // Clean and normalize the input text to handle different line endings
    // \r represents a carriage return character
    // \n represents a line feed (newline) character
    // /g is a global flag that means "replace all occurrences" in the text, not just the first match

    const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Split text into separate question blocks using blank lines as separators
    const questionBlocks = cleanText.split(/\n\s*\n/);
    
    questionBlocks.forEach((block, index) => {
        // Split each block into individual lines and clean whitespace
        const lines = block.trim().split('\n').map(line => line.trim());
        
        // Match the question pattern: number followed by period and text
        const questionMatch = lines[0].match(/^(\d+)\.\s*(.*)/);
        
        if (questionMatch) {
            // Extract question number and text from the match
            const questionNumber = parseInt(questionMatch[1]);
            const questionText = questionMatch[2];
            const answers = [];
            let correctAnswer = null;
            
            // Process only the next 4 lines as answers (A, B, C, D)
            for (let i = 1; i <= 4; i++) {
                if (lines[i]) {
                    // Match answer pattern: letter followed by period and text
                    const answerMatch = lines[i].match(/^([A-D])\.\s*(.*)/);
                    if (answerMatch) {
                        const letter = answerMatch[1];
                        let text = answerMatch[2].trim();
                        
                        // Check for asterisk (*) marking correct answer
                        if (text.endsWith('*')) {
                            text = text.slice(0, -1).trim(); // Remove asterisk
                            correctAnswer = letter; // Store correct answer letter
                        }
                        
                        // Store answer data
                        answers.push({
                            letter: letter,
                            text: text
                        });
                    }
                }
            }
            
            // Only add questions that have all required components
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
    
    return questions;
}

// Validation function to check question format and requirements
function validateQuestions(questions) {
    const errors = [];
    
    questions.forEach(question => {
        console.log('Validating question:', question); // Debug log to see question structure

        // Check if answers array exists and has content
        if (!question.answers || !Array.isArray(question.answers)) {
            console.log('Invalid answers array for question:', question.number);
            return;
        }

        // Check for exactly four answers
        if (question.answers.length !== 4) {
            console.log('Answer count:', question.answers.length); // Debug log
            errors.push(`Question ${question.number} does not have exactly four answers.`);
        }
        
        // Check for exactly one correct answer
        const correctAnswers = question.answers.filter(ans => ans.letter === question.correct);
        console.log('Correct answers found:', correctAnswers.length); // Debug log
        if (correctAnswers.length !== 1) {
            errors.push(`Question ${question.number} does not have exactly one correct answer.`);
        }
        
        // Check answer letters are in sequence (A, B, C, D)
        const expectedLetters = ['A', 'B', 'C', 'D'];
        question.answers.forEach((answer, index) => {
            console.log(`Answer ${index}:`, answer); // Debug log
            if (answer.letter !== expectedLetters[index]) {
                errors.push(`Question ${question.number} has incorrect answer lettering.`);
            }
        });
    });
    
    return errors;
}

// Function to display questions in HTML
function displayQuestions(questions) {
    let htmlContent = "";
    
    questions.forEach(question => {
        // Create question element with container
        htmlContent += `
            <div class="question-container" id="container-${question.number}">
                <div class="question" id="question-${question.number}">
                    ${question.number}. ${question.text}
                </div>
        `;
        
        // Create answer buttons container
        htmlContent += '<div class="answers">';
        
        // Create individual answer buttons
        question.answers.forEach(answer => {
            htmlContent += `
                <button 
                    class="answer-btn" 
                    data-question="${question.number}"
                    data-letter="${answer.letter}"
                    data-correct="${answer.letter === question.correct}">
                    ${answer.letter}. ${answer.text}
                </button>
            `;
        });
        
        htmlContent += '</div>';
        // Add feedback div
        htmlContent += `<div class="feedback" id="feedback-${question.number}"></div>`;
        htmlContent += '</div>';
    });
    
    return htmlContent;
}

// Function to add click listeners to answer buttons
function addAnswerButtonListeners() {
    document.querySelectorAll('.answer-btn').forEach(button => {
        button.addEventListener('click', function() {
            // Get the question container
            const questionNumber = this.getAttribute('data-question');
            const container = document.getElementById(`container-${questionNumber}`);
            const isCorrect = this.getAttribute('data-correct') === 'true';
            
            // Disable all buttons in this question
            container.querySelectorAll('.answer-btn').forEach(btn => {
                btn.disabled = true;
            });
            
            // Add correct/incorrect class
            this.classList.add(isCorrect ? 'correct' : 'incorrect');
            
            // Show feedback
            const feedback = container.querySelector('.feedback');
            feedback.textContent = isCorrect ? 'Correct!' : 'Incorrect!';
            feedback.classList.add(isCorrect ? 'correct' : 'incorrect');
        });
    });
}

// Function to process questions (either from file or sample)
function processQuestions(questionText) {
    const parsedQuestions = parseQuestions(questionText);
    console.log('Parsed Questions:', parsedQuestions); // Debug output

    const validationErrors = validateQuestions(parsedQuestions);
    
    if (validationErrors.length === 0) {
        const htmlContent = displayQuestions(parsedQuestions);
        document.getElementById('quiz-content').innerHTML = htmlContent;
        addAnswerButtonListeners();
    } else {
        console.error('Validation errors:', validationErrors);
        alert('Error in question format. Please check the file format.');
    }
}

// Initial setup when page loads
document.addEventListener('DOMContentLoaded', () => {

    // Add file input event listener
    document.getElementById('questionFile').addEventListener('change', function(e) {
        const file = e.target.files[0];
        console.log('1. File selected:', file);

        if (file) {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                const text = e.target.result;
                console.log('2. File content:', text.substring(0, 100)); // First 100 chars
                
                try {
                    const parsedQuestions = parseQuestions(text);
                    console.log('3. Parsed Questions:', parsedQuestions);
                    
                    const validationErrors = validateQuestions(parsedQuestions);
                    console.log('4. Validation Errors:', validationErrors);
                    
                    if (validationErrors.length === 0) {
                        const htmlContent = displayQuestions(parsedQuestions);
                        console.log('5. Generated HTML:', htmlContent.substring(0, 100));
                        document.getElementById('quiz-content').innerHTML = htmlContent;
                        addAnswerButtonListeners();
                        console.log('6. Questions displayed and listeners added');
                    } else {
                        console.error('Error: Invalid question format');
                        // Keep existing content on error
                    }
                } catch (error) {
                    console.error('Error processing file:', error);
                    // Keep existing content on error
                }
            };

            reader.readAsText(file);
        }
    });
});

