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

        htmlContent += `
            <button class="submit-btn" data-question="${question.number}">
                Submit Answer
            </button>
        `;

        htmlContent += `<div class="feedback" id="feedback-${question.number}"></div>`;
        htmlContent += `<div class="llm-response" id="llm-response-${question.number}" style="display: none;">LLM Explanation will appears here...</div>`;
        htmlContent += `
            <div class="llm-chat-interface-container" id="llm-chat-interface-container-${question.number}" style="display: none;">
                <div class="chat-messages" id="chat-messages-${question.number}"></div>
                <div class="chat-input-area">
                    <textarea class="chat-input" id="chat-input-${question.number}" placeholder="Type your message..." rows="1"></textarea>

                    <button class="send-chat-btn" id="send-chat-btn-${question.number}" data-question-number="${question.number}"><span>&#10148;</span></button>

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
    if (!question) {
        console.error("displaySingleQuestion: No question was provided to display.");
        return '<p>Error: Could not load question.</p>';
    }
    console.log(`displaySingleQuestion: Generating HTML for Question #${question.number}`);

    let htmlContent = '';
    let counterText = `Question ${question.number} of ${totalQuestions}`;

    if (isReviewingSet) {
        let filterDescription = "Flagged Questions";
        if (reviewFilterType === 'unanswered') {
            filterDescription = "Unanswered Questions";
        }
        counterText = `Reviewing ${filterDescription} (${counterText})`;
    } else if (reviewFilterType === 'all') {
        counterText = `Reviewing All Questions (${counterText})`;
    }

    htmlContent += `<div class="question-counter">${counterText}</div>`;

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
    htmlContent += `</fieldset>`; // Close fieldset

    htmlContent += `<div class="exam-navigation">`;
    htmlContent += `<button id="prev-return-btn" class="exam-nav-btn secondary">Previous</button>`;
    htmlContent += `<button id="next-question-btn" class="exam-nav-btn">Next</button>`;
    htmlContent += `</div>`; // Close exam-navigation

    htmlContent += '</div>'; // Close question-container
    return htmlContent;
}


/**
 * UPDATED: This function is no longer needed as the score is not displayed continuously in the new UI.
 * The final score is shown in the modal. We can keep the function in case you want to add a score display later.
 */
function updateScoreDisplay(currentScore, totalAnswered, totalQuestions) {
    // const scoreElement = document.getElementById('score-display'); // This element was removed.
    // console.log("Score update requested, but element is not part of the new UI.");
}

/**
 * Generates the final score message string for the modal.
 */
function showFinalScore(currentScore, totalQuestions) {
    if (totalQuestions === 0) return "No questions were loaded.";
    const incorrectQuestions = totalQuestions - currentScore;
    const finalPercentage = Math.round((currentScore / totalQuestions) * 100);
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
 * UPDATED: Updates the progress bar visuals in the new floating navigation bar.
 */
function updateProgressBar(answeredQuestions, totalQuestions) {
    // UPDATED: Selectors now target the new progress bar elements in the nav.
    const progressFill = document.getElementById('progress-fill'); 
    const progressText = document.getElementById('progress-text');
    
    if (!progressFill || !progressText) {
        console.warn("Progress bar elements not found. Check your new HTML structure.");
        return;
    }
    
    const progressPercentage = totalQuestions > 0 ? (answeredQuestions / totalQuestions) * 100 : 0;
    progressFill.style.width = `${progressPercentage}%`;
    // UPDATED: Text format changed to be more compact for the new UI.
    progressText.textContent = `${answeredQuestions}/${totalQuestions}`;
}

/**
 * UPDATED: Resets UI displays to their initial state for a new quiz.
 */
function resetDisplays(totalQuestions) {
    // UPDATED: Selectors changed to match new HTML elements.
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    const timerElement = document.getElementById('timer-display'); // This ID is still correct in the new HTML

    // Reset visual elements
    if (progressFill) progressFill.style.width = '0%';
    if (progressText) progressText.textContent = `0/${totalQuestions}`;
    if (timerElement) timerElement.textContent = '00:00:00';

    // The old score display update is removed as the element no longer exists.
    // updateScoreDisplay(0, 0, totalQuestions);
}

/**
 * Renders the generated HTML content into the quiz container.
 * This function remains unchanged as the '#quiz-content' element is still present.
 */
function renderQuestions(htmlContent) {
    document.getElementById('quiz-content').innerHTML = htmlContent;
}


/**
 * Generates the HTML for the pre-submission review screen in Exam Mode.
 * This function remains largely unchanged but ensures it still works within the new layout.
 */
function displayReviewScreen(questions) {
    console.log("displayReviewScreen: Generating HTML for the review screen.");
    
    // Calculate counts for the filter buttons
    const unansweredCount = questions.filter(q => q.userSelected.length === 0).length;
    const flaggedCount = questions.filter(q => q.isFlaggedForReview).length;

    let htmlContent = `
        <div class="review-screen-container">
            <h2 class="review-header">Review Your Answers</h2>
            <p class="review-instructions">
                Below is a summary of your answers. Click on any question to review it. You can filter the list to show only Unanswered or Flagged questions. When you are finished, click "Grade Exam".
            </p>

            <div class="review-filters">
                <button class="filter-btn active" data-filter="all">All (${questions.length})</button>
                <button class="filter-btn" data-filter="unanswered">Unanswered (${unansweredCount})</button>
                <button class="filter-btn" data-filter="flagged">Flagged (${flaggedCount})</button>
            </div>

            <div class="review-question-list">
    `;

    questions.forEach(question => {
        let status = 'Answered';
        if (question.userSelected.length === 0) {
            status = 'Unanswered';
        }
        
        const flaggedClass = question.isFlaggedForReview ? 'flagged' : '';

        htmlContent += `
            <div class="review-question-item ${flaggedClass}" data-question-index="${question.number - 1}">
                <span class="review-q-number">Question ${question.number}</span>
                <span class="review-q-status">${status}</span>
                ${question.isFlaggedForReview ? '<i class="fa-solid fa-flag"></i>' : ''}
            </div>
        `;
    });

    htmlContent += `
            </div> 
            <button id="grade-exam-btn" class="grade-exam-btn">Grade Exam</button>
        </div>
    `;

    return htmlContent;
}

/**
 * Generates only the HTML for the list of questions on the review screen.
 * This function remains unchanged.
 */
function generateReviewListHTML(questions) {
    let listHtml = '';

    if (questions.length === 0) {
        return '<p class="review-no-items">No questions match this filter.</p>';
    }

    questions.forEach(question => {
        let status = 'Answered';
        if (question.userSelected.length === 0) {
            status = 'Unanswered';
        }
        
        const flaggedClass = question.isFlaggedForReview ? 'flagged' : '';

        listHtml += `
            <div class="review-question-item ${flaggedClass}" data-question-index="${question.number - 1}">
                <span class="review-q-number">Question ${question.number}</span>
                <span class="review-q-status">${status}</span>
                ${question.isFlaggedForReview ? '<i class="fa-solid fa-flag"></i>' : ''}
            </div>
        `;
    });
    
    return listHtml;
}

/**
 * Creates and manages a fully themeable, modern dropdown menu from a standard <select> element.
 * This function is designed to be called for each <select> you want to transform.
 * @param {HTMLSelectElement} originalSelect The original <select> element to transform.
 */
function createCustomSelect(originalSelect) {
    // --- PREVENT DUPLICATION ---
    // This check ensures that if the function is accidentally called twice on the same element,
    // it won't create a second custom dropdown. It looks inside the <select>'s parent
    // to see if a '.custom-select-wrapper' already exists.
    if (originalSelect.parentElement.querySelector('.custom-select-wrapper')) {
        return; // Exit the function if it's already been transformed.
    }

    // --- SETUP ---
    // Hide the original <select> element. We keep it in the HTML because it stores the
    // actual form value and is essential for other scripts to work correctly.
    originalSelect.style.display = 'none';

    // Create a new 'div' that will be the main container for our custom dropdown.
    const wrapper = document.createElement('div');
    wrapper.className = 'custom-select-wrapper'; // Apply our CSS class for styling.

    // --- BUILD THE HTML ---
    // Use a template literal to create the inner HTML for our custom dropdown.
    // It consists of a "trigger" (the part you click) and a container for the "options".
    wrapper.innerHTML = `
        <div class="custom-select-trigger">
            <span>${originalSelect.options[originalSelect.selectedIndex]?.textContent || 'Select...'}</span>
            <div class="arrow"></div>
        </div>
        <div class="custom-options"></div>
    `;

    // Add the newly created custom dropdown (`wrapper`) to the page.
    // It's placed inside the same container that the original <select> was in.
    originalSelect.parentElement.appendChild(wrapper);

    // Get references to the parts of our new custom dropdown so we can add event listeners to them.
    const trigger = wrapper.querySelector('.custom-select-trigger');
    const optionsContainer = wrapper.querySelector('.custom-options');
    const triggerText = trigger.querySelector('span');

    // --- POPULATE OPTIONS ---
    // This helper function reads the <option>s from the original, hidden <select>
    // and creates a styled <div> for each one inside our custom dropdown.
    const populateOptions = () => {
        optionsContainer.innerHTML = ''; // Clear any existing custom options first.
        for (const option of originalSelect.options) {
            const customOption = document.createElement('div');
            customOption.className = 'custom-option'; // Assign class for styling.
            customOption.textContent = option.textContent; // Set the display text.
            customOption.dataset.value = option.value; // Store the option's value in a data attribute.

            // If this option is the currently selected one in the original <select>,
            // add the 'selected' class for styling and update the trigger's text.
            if (option.selected) {
                customOption.classList.add('selected');
                triggerText.textContent = option.textContent;
            }
            optionsContainer.appendChild(customOption);
        }
    };

    // Call the function immediately to populate the options when the dropdown is first created.
    populateOptions();

    // --- EVENT LISTENERS ---

    // When the trigger area is clicked...
    trigger.addEventListener('click', (e) => {
        e.stopPropagation(); // Stop the click from bubbling up to the 'document' click listener.
        // First, close any *other* custom dropdowns that might be open.
        document.querySelectorAll('.custom-select-wrapper.open').forEach(openWrapper => {
            if (openWrapper !== wrapper) openWrapper.classList.remove('open');
        });
        // Then, toggle the 'open' class on the current dropdown to show or hide the options.
        wrapper.classList.toggle('open');
    });

    // Use "event delegation" to handle clicks on the options.
    // This one listener on the container is more efficient than adding a listener to every single option.
    optionsContainer.addEventListener('click', (e) => {
        // Check if the clicked element is actually an option.
        if (e.target.classList.contains('custom-option')) {
            const selectedOption = e.target;
            
            // Update the visual selection style.
            optionsContainer.querySelector('.selected')?.classList.remove('selected');
            selectedOption.classList.add('selected');
            
            // Update the text in the trigger to show the new selection.
            triggerText.textContent = selectedOption.textContent;
            
            // **CRUCIAL**: Update the value of the original, hidden <select> element.
            originalSelect.value = selectedOption.dataset.value;
            
            // **CRUCIAL**: Manually trigger a 'change' event on the original select. This is how
            // your other scripts (like the one that shows API settings) know a selection was made.
            originalSelect.dispatchEvent(new Event('change'));

            // Close the dropdown.
            wrapper.classList.remove('open');
        }
    });

    // --- DYNAMIC CONTENT HANDLING (The Modern Fix) ---
    // Create a MutationObserver to watch for changes to the original <select> element.
    // This is the correct, modern way to handle dynamic content (like Ollama models loading).
    const observer = new MutationObserver(() => {
        // When the observer detects a change (e.g., new <option>s are added),
        // it calls our populateOptions function to rebuild the custom dropdown.
        populateOptions();
    });

    // Tell the observer what to watch for: changes to the direct children (the <option>s) of the select element.
    observer.observe(originalSelect, { childList: true });
}

// --- GLOBAL EVENT LISTENERS ---

// A single listener on the whole document to close any open dropdown when you click elsewhere.
document.addEventListener('click', () => {
    document.querySelectorAll('.custom-select-wrapper.open').forEach(wrapper => {
        wrapper.classList.remove('open');
    });
});

// When the initial HTML document has been completely loaded and parsed...
document.addEventListener('DOMContentLoaded', () => {
    // Find every `<select>` inside a `.custom-select-container` and run our function on it.
    document.querySelectorAll('.custom-select-container select').forEach(selectElement => {
        createCustomSelect(selectElement);
    });
});