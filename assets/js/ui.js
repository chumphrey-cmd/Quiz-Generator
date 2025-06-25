/**
 * Uses radio buttons for single-answer, checkboxes for multi-answer questions.
 * Includes a submit button for each question.
 * @param {Array} questions - Array of question objects
 * @returns {string} HTML string containing all questions and answer inputs
 */
function displayQuestions(questions) {
    console.log("Displaying questions:", questions);
    let htmlContent = "";

    questions.forEach(question => {
        const isMultipleChoice = question.correct.length > 1;
        const inputType = isMultipleChoice ? 'checkbox' : 'radio';
        const formattedQuestionText = typeof marked !== 'undefined' ? marked.parseInline(question.text) : question.text;

        htmlContent += `
            <div class="question-container" id="container-${question.number}" data-question-number="${question.number}">
                <div class="question-header">
                    <div class="question" id="question-${question.number}">
                        ${question.number}. ${formattedQuestionText}
                        ${isMultipleChoice ? '<span class="question-hint">(Select all that apply)</span>' : ''}
                    </div>
                    <div class="explain-container" title="Explain Question">
                        <i class="fa-solid fa-wand-magic-sparkles explain-icon" data-question-number="${question.number}"></i>
                    </div>
                    <div class="flag-container" title="Flag for Review">
                        <i class="fa-regular fa-flag flag-icon" data-question-number="${question.number}"></i>
                    </div>
                </div>
        `;
        htmlContent += `<fieldset class="answers" id="answers-${question.number}" data-question="${question.number}" data-input-type="${inputType}">`;

        question.answers.forEach(answer => {
            const inputId = `q${question.number}-ans${answer.letter}`;
            const inputName = `question_${question.number}`;
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

        htmlContent += '</fieldset>';

        // The submit button is now always shown, as this function only renders active quizzes.
        htmlContent += `
            <button class="submit-btn" data-question="${question.number}">
                Submit Answer
            </button>
        `;

        // Add placeholders for feedback and LLM features
        htmlContent += `<div class="feedback" id="feedback-${question.number}"></div>`;
        htmlContent += `<div class="llm-response" id="llm-response-${question.number}" style="display: none;">LLM Explanation will appear here...</div>`;
        htmlContent += `
            <div class="llm-chat-interface-container" id="llm-chat-interface-container-${question.number}" style="display: none;">
                <div class="chat-messages" id="chat-messages-${question.number}"></div>
                <div class="chat-input-area">
                    <textarea class="chat-input" id="chat-input-${question.number}" placeholder="Type your message..."></textarea>
                    <button class="send-chat-btn" id="send-chat-btn-${question.number}" data-question-number="${question.number}">Send</button>
                </div>
            </div>
        `;
        htmlContent += '</div>';
    });

    console.log("Final HTML content generated.");
    return htmlContent;
}

/**
 * Generates the HTML for a single question view, used for 'Exam Mode'.
 * @param {object} question - The single question object to display.
 * @param {number} totalQuestions - The total number of questions in the quiz.
 * @param {boolean} [isReviewingSet=false] - If true, displays a 'Return to Summary' button.
 * @param {string} [reviewFilterType='all'] - The active filter ('all', 'flagged', 'unanswered').
 * @returns {string} A string of HTML representing the single question view.
 */
function displaySingleQuestion(question, totalQuestions, isReviewingSet = false, reviewFilterType = 'all') {
    // Safety check: If for some reason no question is passed, return an error message.
    if (!question) {
        console.error("displaySingleQuestion: No question was provided to display.");
        return '<p>Error: Could not load question.</p>';
    }
    console.log(`displaySingleQuestion: Generating HTML for Question #${question.number}`);

    // This string will accumulate all the HTML we generate.
    let htmlContent = '';

    // === LOGIC FOR CONTEXT-AWARE COUNTER ============================
    // 1. Start with the basic counter text.
    let counterText = `Question ${question.number} of ${totalQuestions}`;

    // 2. Check if the user is in a filtered review set.
    if (isReviewingSet) {
        // If they are, create a more descriptive label based on the active filter.
        let filterDescription = "Flagged Questions"; // Default description
        if (reviewFilterType === 'unanswered') {
            filterDescription = "Unanswered Questions";
        }
        // Combine the description with the basic counter.
        // Example output: "Reviewing Flagged Questions (Question 15 of 82)"
        counterText = `Reviewing ${filterDescription} (${counterText})`;
    } else if (reviewFilterType === 'all') {
        // If the user is navigating from the review screen but using the 'All' filter,
        // we provide a slightly different description for clarity.
        counterText = `Reviewing All Questions (${counterText})`;
    }

    // --- 1. Create the Question Counter ---
    // This now uses our new, more descriptive 'counterText'.
    htmlContent += `
        <div class="question-counter">
            ${counterText}
        </div>
    `;

    // --- 2. Create the Question Block (Unchanged) ---
    // This part remains the same.
    const isMultipleChoice = question.correct.length > 1;
    const inputType = isMultipleChoice ? 'checkbox' : 'radio';
    const formattedQuestionText = typeof marked !== 'undefined' ? marked.parseInline(question.text) : question.text;
    const isFlagged = question.isFlaggedForReview;

    htmlContent += `
        <div class="question-container" id="container-${question.number}" data-question-number="${question.number}">
            <div class="question-header">
                <div class="question" id="question-${question.number}">
                    ${formattedQuestionText}
                    ${isMultipleChoice ? '<span class="question-hint">(Select all that apply)</span>' : ''}
                </div>
                <div class="flag-container" title="Flag for Review">
                    <i class="${isFlagged ? 'fa-solid' : 'fa-regular'} fa-flag flag-icon ${isFlagged ? 'flagged' : ''}" data-question-number="${question.number}"></i>
                </div>
            </div>
    `;
    
    // --- 3. Create the Answer Options ---
    htmlContent += `<fieldset class="answers" id="answers-${question.number}" data-question="${question.number}" data-input-type="${inputType}">`;

    question.answers.forEach(answer => {
        const inputId = `q${question.number}-ans${answer.letter}`;
        const inputName = `question_${question.number}`;
        const formattedAnswerText = typeof marked !== 'undefined' ? marked.parseInline(answer.text) : answer.text;
        const isChecked = question.userSelected.includes(answer.letter);

        htmlContent += `
            <div class="answer-option"> 
                <input
                    type="${inputType}" 
                    class="answer-input" 
                    id="${inputId}"
                    name="${inputName}"
                    value="${answer.letter}"
                    data-question="${question.number}"
                    ${isChecked ? 'checked' : ''}
                />
                <label for="${inputId}" class="answer-label"> 
                    ${answer.letter}. ${formattedAnswerText}
                </label>
            </div>
        `;
    });

    // --- 4. Create the Navigation Controls ---
    htmlContent += `<div class="exam-navigation">`;

    // We assign a consistent ID, 'prev-return-btn', to this button. This makes
    // it much easier to find and remove in our logic later to prevent duplicates.
    if (isReviewingSet) {
        htmlContent += `<button id="prev-return-btn" class="exam-nav-btn secondary">Return to Summary</button>`;
    } else {
        htmlContent += `<button id="prev-return-btn" class="exam-nav-btn">Previous</button>`;
    }
    
    htmlContent += `
        <button id="next-question-btn" class="exam-nav-btn">Next</button>
        </div>
    `;

    // Return the complete HTML string to be injected into the DOM.
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

/**
 * Generates the HTML for the pre-submission review screen in Exam Mode.
 * This screen lists all questions, shows their status, and provides filter/grading controls.
 * @param {Array<object>} questions - The array of all question objects for the current quiz.
 * @returns {string} A string of HTML representing the review screen.
 */
function displayReviewScreen(questions) {
    console.log("displayReviewScreen: Generating HTML for the review screen.");
    
    let htmlContent = `
        <div class="review-screen-container">
            <h2 class="review-header">Review Your Answers</h2>
            <p class="review-instructions">
                Below is a summary of your answers. Click on any question to review it. You can filter the list to show only Unanswered or Flagged questions. When you are finished, click "Grade Exam".
            </p>

            <div class="review-filters">
                <button class="filter-btn active" data-filter="all">All (${questions.length})</button>
                <button class="filter-btn" data-filter="unanswered">Unanswered</button>
                <button class="filter-btn" data-filter="flagged">Flagged</button>
            </div>

            <div class="review-question-list">
    `;

    // Loop through each question to create a list item for it.
    questions.forEach(question => {
        // Determine the status of the question for styling and information.
        let status = 'Answered';
        if (question.userSelected.length === 0) {
            status = 'Unanswered';
        }
        
        // Add a 'flagged' class if the user has flagged this question.
        const flaggedClass = question.isFlaggedForReview ? 'flagged' : '';

        htmlContent += `
            <div class="review-question-item ${flaggedClass}" data-question-index="${question.number - 1}">
                <span class="review-q-number">Question ${question.number}</span>
                <span class="review-q-status">${status}</span>
                ${question.isFlaggedForReview ? '<i class="fa-solid fa-flag"></i>' : ''}
            </div>
        `;
    });

    // Close the list and container divs.
    htmlContent += `
            </div> 
            <button id="grade-exam-btn" class="grade-exam-btn">Grade Exam</button>
        </div>
    `;

    return htmlContent;
}

/**
 * Generates only the HTML for the list of questions on the review screen.
 * This is a helper function used to re-render just the list when filters are applied.
 * @param {Array<object>} questions - The array of question objects to display in the list.
 * @returns {string} An HTML string of the question items.
 */
function generateReviewListHTML(questions) {
    let listHtml = '';

    // If the filtered array of questions is empty, we should display a
    // helpful message to the user instead of just showing a blank space.
    if (questions.length === 0) {
        return '<p class="review-no-items">No questions match this filter.</p>';
    }

    // We loop through the provided array of questions (which might be the full list,
    // or a smaller filtered list) to create the HTML for each item.
    questions.forEach(question => {
        // Determine the question's current status for display.
        let status = 'Answered';
        if (question.userSelected.length === 0) {
            status = 'Unanswered';
        }
        
        // Check if the question is flagged to add the appropriate class and icon.
        const flaggedClass = question.isFlaggedForReview ? 'flagged' : '';

        // Generate the HTML for this single item in the list.
        listHtml += `
            <div class="review-question-item ${flaggedClass}" data-question-index="${question.number - 1}">
                <span class="review-q-number">Question ${question.number}</span>
                <span class="review-q-status">${status}</span>
                ${question.isFlaggedForReview ? '<i class="fa-solid fa-flag"></i>' : ''}
            </div>
        `;
    });
    
    // Return the completed string of HTML.
    return listHtml;
}