// Global state variables for tracking quiz progress
let totalQuestions = 0;      // Total number of questions in the quiz
let answeredQuestions = 0;   // Number of questions answered so far
let currentScore = 0;        // Current number of correct answers

/**
 * Generates HTML content for displaying questions
 * @param {Array} questions - Array of question objects
 * @returns {string} HTML string containing all questions and answer buttons
 */
function displayQuestions(questions) {
    console.log("Starting to display questions:", questions);
    let htmlContent = "";
    
    questions.forEach(question => {
        // Create container for each question with unique ID
        htmlContent += `
            <div class="question-container" id="container-${question.number}">
                <div class="question" id="question-${question.number}">
                    ${question.number}. ${question.text}
                </div>
        `;
        
        // Create container for answer buttons
        htmlContent += '<div class="answers">';
        
        // Generate buttons for each answer option
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
        
        // Close answer container and add feedback div
        htmlContent += '</div>';
        htmlContent += `<div class="feedback" id="feedback-${question.number}"></div>`;
        htmlContent += '</div>';
    });

    console.log("Final HTML content:", htmlContent);
    return htmlContent;
}

function updateScoreDisplay(currentScore, totalAnswered, totalQuestions) {
    console.log('Updating score with:', {currentScore, totalAnswered, totalQuestions});
    
    const scoreElement = document.getElementById('score-display');
    const incorrectAnswers = totalAnswered - currentScore;
    const percentage = totalQuestions > 0 ? Math.round((currentScore / totalQuestions) * 100) : 0;
    
    scoreElement.textContent = `Score: ${currentScore}/${totalQuestions} | Correct: ${currentScore} | Incorrect: ${incorrectAnswers} (${percentage}%)`;
}

function showFinalScore(currentScore, totalQuestions) {
    const incorrectAnswers = totalQuestions - currentScore;
    const finalPercentage = Math.round((currentScore / totalQuestions) * 100);
    
    return `
Quiz Complete!
─────────────────────
Total Questions: ${totalQuestions}
Correct Answers: ${currentScore}
Incorrect Answers: ${incorrectAnswers}
Final Score: ${finalPercentage}%
─────────────────────`;
}

/**
 * Adds click event listeners to all answer buttons
 * Handles answer selection, feedback, and score updating
 */
function addAnswerButtonListeners() {
    let totalQuestions = document.querySelectorAll('.question-container').length;

    document.querySelectorAll('.answer-btn').forEach(button => {
        button.addEventListener('click', function() {
            // Get question data from button attributes
            const questionNumber = this.getAttribute('data-question');
            const container = document.getElementById(`container-${questionNumber}`);
            const isCorrect = this.getAttribute('data-correct') === 'true';
            
            // Disable all buttons in this question to prevent multiple answers
            container.querySelectorAll('.answer-btn').forEach(btn => {
                btn.disabled = true;
            });
            
            // Add visual feedback to clicked button
            this.classList.add(isCorrect ? 'correct' : 'incorrect');
            
            // Show feedback message
            const feedback = container.querySelector('.feedback');
            feedback.textContent = isCorrect ? 'Correct!' : 'Incorrect!';
            feedback.classList.add(isCorrect ? 'correct' : 'incorrect');

            // Update score and progress
            if (isCorrect) currentScore++;
            answeredQuestions++;
            
            // Update UI displays
            updateScoreDisplay();
            updateProgressBar();
        });
    });
}

/**
 * Updates the progress bar and question counter
 * Shows progress as percentage and fraction
 */
function updateProgressBar() {
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    const progressPercentage = (answeredQuestions / totalQuestions) * 100;
    
    // Update progress bar width and text
    progressFill.style.width = `${progressPercentage}%`;
    progressText.textContent = `${answeredQuestions}/${totalQuestions} Questions`;
}

/**
 * Resets all displays to initial state
 * Called when starting a new quiz
 */
function resetDisplays() {
    // Reset state variables
    currentScore = 0;
    answeredQuestions = 0;
    
    // Reset UI elements
    document.getElementById('score-display').textContent = `Score: 0/${totalQuestions} (0%)`;
    document.getElementById('progress-fill').style.width = '0%';
    document.getElementById('progress-text').textContent = `0/${totalQuestions} Questions`;
}

/**
 * Renders questions in the quiz container
 * @param {string} htmlContent - HTML string containing questions
 */
function renderQuestions(htmlContent) {
    document.getElementById('quiz-content').innerHTML = htmlContent;
}
