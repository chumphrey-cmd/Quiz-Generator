/**
 * Uses radio buttons for single-answer, checkboxes for multi-answer questions.
 * Includes a submit button for each question.
 * @param {Array} questions - Array of question objects
 * @returns {string} HTML string containing all questions and answer inputs
 */
function displayQuestions(questions) {

    // Debug for MD parsing
    console.log('Is marked defined?', typeof marked);

    console.log("Starting to display questions (conditional radio/checkbox):", questions);
    let htmlContent = "";

    questions.forEach(question => {
        const isMultipleChoice = question.correct.length > 1;
        const inputType = isMultipleChoice ? 'checkbox' : 'radio';

        // Use marked.parse() to convert markdown in question text to HTML.
        // Ensure marked library is loaded before this script runs.
        const formattedQuestionText = typeof marked !== 'undefined' ? marked.parseInline(question.text) : question.text; 

        htmlContent += `
            <div class="question-container" id="container-${question.number}" data-question-number="${question.number}">

                <div class="question-header">
                    <div class="question" id="question-${question.number}">
                        ${question.number}. ${formattedQuestionText}
                        ${isMultipleChoice ? '<span class="question-hint">(Select all that apply)</span>' : ''}
                    </div>
                    <button class="explain-btn" data-question-number="${question.number}">Explain</button>
                </div>
        `;
        htmlContent += `<fieldset class="answers" id="answers-${question.number}" data-question="${question.number}" data-input-type="${inputType}">`;

        // Generate inputs (radio or checkbox) and labels conditionally
        question.answers.forEach(answer => {
            const inputId = `q${question.number}-ans${answer.letter}`;
            const inputName = `question_${question.number}`; // Same name groups radio buttons

             // Also parse markdown in answer text
             const formattedAnswerText = typeof marked !== 'undefined' ? marked.parseInline(answer.text) : answer.text;

            htmlContent += `
                <div class="answer-option"> 
                    <input
                        type="${inputType}" 
                        class="answer-input" 
                        id="${inputId}"
                        name="${inputName}"
                        value="${answer.letter}"
                        data-question="${question.number}"
                    />
                    <label for="${inputId}" class="answer-label"> 
                        ${answer.letter}. ${formattedAnswerText}
                    </label>
                </div>
            `;
        });

        htmlContent += '</fieldset>'; // Close answers fieldset

        htmlContent += `
            <button class="submit-btn" data-question="${question.number}">
                Submit Answer
            </button>
        `;

        // Feedback and LLM response areas remain structurally the same
        htmlContent += `<div class="feedback" id="feedback-${question.number}"></div>`;
        // Ensure the initial LLM response area is also hidden by default or controlled by logic
        htmlContent += `<div class="llm-response" id="llm-response-${question.number}" style="display: none;">LLM Explanation will appear here...</div>`;

        // HTML for the Chat Interface
        htmlContent += `
            <div class="llm-chat-interface-container" id="llm-chat-interface-container-${question.number}" style="display: none;">
                <div class="chat-messages" id="chat-messages-${question.number}">
                    </div>
                <div class="chat-input-area">
                    <textarea class="chat-input" id="chat-input-${question.number}" placeholder="Type your message..."></textarea>
                    <button class="send-chat-btn" id="send-chat-btn-${question.number}" data-question-number="${question.number}">Send</button>
                </div>
            </div>
        `;

        htmlContent += '</div>'; // Close question-container
    });

    console.log("Final HTML content with conditional inputs and chat placeholders generated.");
    return htmlContent;
}

/**
 * Updates the score display in the header.
 * Assumes ExamManager provides counts of correctly answered questions.
 */
function updateScoreDisplay(currentScore, totalAnswered, totalQuestions) {
    const scoreElement = document.getElementById('score-display');
    if (!scoreElement) return;
    const percentage = totalQuestions > 0 ? Math.round((currentScore / totalQuestions) * 100) : 0;
    // Display format can be adjusted here if needed
    scoreElement.textContent = `Correct: ${currentScore} | Answered: ${totalAnswered} / ${totalQuestions} (${percentage}%)`;
}

/**
 * Generates the final score message string.
 */
function showFinalScore(currentScore, totalQuestions) {
    if (totalQuestions === 0) return "No questions were loaded.";
    const incorrectQuestions = totalQuestions - currentScore; // Assumes score = count of fully correct questions
    const finalPercentage = Math.round((currentScore / totalQuestions) * 100);
    // Formats the final score message
    return `
Quiz Complete!
─────────────────────
Total Questions: ${totalQuestions}
Correct Questions: ${currentScore}
Incorrect Questions: ${incorrectQuestions}
Final Score: ${finalPercentage}%
─────────────────────`;
}

/**
 * Updates the progress bar visuals.
 */
function updateProgressBar(answeredQuestions, totalQuestions) {
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    if (!progressFill || !progressText) return;
    const progressPercentage = totalQuestions > 0 ? (answeredQuestions / totalQuestions) * 100 : 0;
    progressFill.style.width = `${progressPercentage}%`;
    progressText.textContent = `${answeredQuestions}/${totalQuestions} Questions`;
}

/**
 * Resets UI elements (score, progress, timer) to initial state.
 * Called by ExamManager before displaying new questions.
 */
function resetDisplays(totalQuestions) {
    const scoreElement = document.getElementById('score-display');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    const timerElement = document.getElementById('timer-display');

    // Reset visual elements
    if (scoreElement) updateScoreDisplay(0, 0, totalQuestions); // Start with 0 correct, 0 answered
    if (progressFill) progressFill.style.width = '0%';
    if (progressText) progressText.textContent = `0/${totalQuestions} Questions`;
    if (timerElement) timerElement.textContent = '00:00:00'; // Or display initial duration

    // Note: Clearing quiz content (innerHTML = '') is typically handled by ExamManager
    // just before calling renderQuestions.
}

/**
 * Renders the generated HTML content into the quiz container.
 */
function renderQuestions(htmlContent) {
    // Gets the main content area and injects the question HTML
    document.getElementById('quiz-content').innerHTML = htmlContent;
}