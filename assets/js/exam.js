/**
 * Converts a standard messages array to the format expected by the Google Gemini API (generateContent).
 * @param {Array<Object>} messagesArray - Array of message objects {role: string, content: string}.
 * @returns {Array<Object>} Array of message objects formatted for Gemini API {role: string, parts: [{text: string}]}.
 */
function convertMessagesToGeminiFormat(messagesArray) {
    console.log("convertMessagesToGeminiFormat: Converting messages for Gemini:", messagesArray);
    const geminiMessages = messagesArray.map(msg => {
        let role = msg.role;
        if (msg.role === 'assistant') {
            role = 'model'; // Gemini uses 'model' for assistant responses
        } else if (msg.role === 'system') {
            // System messages are handled by the 'systemInstruction' field in the main request for some Gemini models,
            // so they are typically not included in the 'contents' array directly when 'systemInstruction' is used.
            // If 'systemInstruction' isn't used, they might be mapped to 'user'.
            // For this function, we'll map 'system' to 'user' if it's found in the main message history
            // that's intended for the 'contents' field, assuming 'systemInstruction' handles the primary system prompt.
            role = 'user'; 
            console.warn("convertMessagesToGeminiFormat: System message from history is being mapped to role 'user' for Gemini 'contents' array. The primary system prompt should be handled by the 'systemInstruction' field in the API call if the model supports it.");
        }
        return {
            role: role, // Should be 'user' or 'model' for the 'contents' array
            parts: [{ text: msg.content }]
        };
    });
    // Ensure only 'user' and 'model' roles are in the array for the 'contents' field.
    const filteredGeminiMessages = geminiMessages.filter(msg => msg.role === 'user' || msg.role === 'model');
    console.log("convertMessagesToGeminiFormat: Converted Gemini messages for 'contents' array:", filteredGeminiMessages);
    return filteredGeminiMessages;
}

class ExamManager {

    /*
    ==========================================================================
    --- 1. CONSTRUCTOR ---
    Initializes properties and binds event handlers.
    ==========================================================================
    */

    /**
     * Initialize exam manager with default state
     */
    constructor() {
        // --- Quiz State Variables ---
        this.totalQuestions = 0;
        this.answeredQuestions = 0;
        this.currentScore = 0;
        this.questions = [];
        this.originalQuestions = []; // Used to store original imported Qs
        this.timerInterval = null;
        this.timeRemaining = 0;
        const initialTimerInput = document.getElementById('timerDurationInput');
        this.timerDuration = (initialTimerInput ? parseInt(initialTimerInput.value, 10) : 10) * 60;
        this.isTimerEnabled = true; // Timer is ON by default
        this.isTimeInfinite = false; // Tracks if the timer is set to no limit
        this.initialTimerDuration = 0; // Stores the duration set by user (in seconds)
        this.isTimerRunning = false;   // Tracks if countdown is active (running or paused)
        this.isTimerPaused = false;    // Tracks if countdown is specifically paused

        // --- Chat History Storage ---
        // This object will store chat histories for each question.
        // The keys will be question numbers, and the values will be arrays of message objects.
        this.chatHistories = {}; 
        console.log("ExamManager initialized: Chat histories object created.", this.chatHistories);

        // --- Bound Event Handlers ---
        this.handleFileUploadBound = this.handleFileUpload.bind(this);
        this.handleSubmitClickBound = this.handleSubmitClick.bind(this);
        this.handleExplainClickBound = this.handleExplainClick.bind(this);
        this.handleTimerToggleClickBound = this.handleTimerToggleClick.bind(this);
        this.handleSendChatMessageBound = this.handleSendChatMessage.bind(this);
        this.handleTimerStartPauseResumeClickBound = this.handleTimerStartPauseResumeClick.bind(this);
        this.handleTimerResetClickBound = this.handleTimerResetClick.bind(this);

        // --- Initialize Event Listeners ---
        this.initializeEventListeners();
        

        // -- Populate Ollama models ---
        this.populateOllamaModelsDropdown(); 

        // --- Set initial button states for timer ---
        this._updateTimerControlEventsUI();

        console.log("ExamManager constructor finished.");
    }

    /* 
    ==========================================================================
    --- 2. INITIALIZATION ---
    Methods related to setting up initial state or dynamic event listeners.
    ==========================================================================
    */

// In assets/js/exam.js

    /**
     * Sets up all persistent event listeners for the application.
     * This method is called only once when the ExamManager is created.
     */
    initializeEventListeners() {
        console.log("Initializing all persistent event listeners...");

        // --- Listeners for Static Header Controls ---
        const fileInput = document.getElementById('questionFile');
        if (fileInput) {
            fileInput.addEventListener('change', this.handleFileUploadBound);
        } else { console.error("File input element 'questionFile' not found!"); }

        const timerInput = document.getElementById('timerDurationInput');
        if (timerInput) {
            timerInput.addEventListener('input', function() {
                this.value = this.value.replace(/[^0-9]/g, '');
                if (this.value.length > 1 && this.value.startsWith('0')) this.value = this.value.substring(1);
                if (this.value === '') this.value = '1';
            });
            timerInput.addEventListener('blur', function() {
                const min = parseInt(this.min, 10) || 1;
                const max = parseInt(this.max, 10) || 999999;
                let currentValue = parseInt(this.value, 10);
                if (isNaN(currentValue) || currentValue < min) this.value = min;
                else if (currentValue > max) this.value = max;
            });
        } else { console.error("Timer duration input element not found!"); }

        const timerToggleButton = document.getElementById('timerToggleButton');
        if (timerToggleButton) {
            timerToggleButton.addEventListener('click', this.handleTimerToggleClickBound);
            this.updateTimerToggleButtonVisuals(timerToggleButton);
        } else { console.error("Timer toggle button 'timerToggleButton' not found!");}

        const startPauseResumeButton = document.getElementById('timerStartPauseResumeButton');
        if (startPauseResumeButton) {
            this.handleTimerStartPauseResumeClickBound = this.handleTimerStartPauseResumeClick.bind(this);
            startPauseResumeButton.addEventListener('click', this.handleTimerStartPauseResumeClickBound);
        } else {
            console.error("Timer Start/Pause/Resume button 'timerStartPauseResumeButton' not found!");
        }

        const resetButton = document.getElementById('timerResetButton');
        if (resetButton) {
            this.handleTimerResetClickBound = this.handleTimerResetClick.bind(this);
            resetButton.addEventListener('click', this.handleTimerResetClickBound);
        } else {
            console.error("Timer Reset button 'timerResetButton' not found!");
        }

        // --- Master Listener for Dynamic Quiz Content (Event Delegation) ---
        const quizContentElement = document.getElementById('quiz-content');
        if (quizContentElement) {
            this.handleQuizContentClickBound = this.handleQuizContentClick.bind(this);
            quizContentElement.addEventListener('click', this.handleQuizContentClickBound);
            console.log("Master event listener attached to #quiz-content for delegation.");
        } else {
            console.error("CRITICAL: Could not find #quiz-content div to attach master listener.");
        }

        // --- Listeners for Static Modal Buttons ---
        console.log("Attempting to find and attach listeners to modal buttons...");
        const retakeBtn = document.getElementById('retake-quiz-btn');
        if (retakeBtn) {
            retakeBtn.addEventListener('click', () => {
                console.log("'Retake Exam' button clicked.");
                this.startNewQuiz(this.originalQuestions);
            });
            console.log("Event listener attached to 'Retake Exam' button.");
        }

        const reviewBtn = document.getElementById('review-session-btn');
        if (reviewBtn) {
            reviewBtn.addEventListener('click', () => {
                console.log("'Review' button clicked.");
                this.initiateReviewQuiz();
            });
            console.log("Event listener attached to 'Review' button.");
        }

        const importBtn = document.getElementById('import-new-btn');
        if (importBtn) {
            importBtn.addEventListener('click', () => {
                console.log("'Import New' button clicked.");
                document.getElementById('questionFile').click();
                document.getElementById('end-of-quiz-modal-container').classList.remove('show');
            });
            console.log("Event listener attached to 'Import New' button.");
        }
    }

    /**
     * Event handler that listens for all clicks inside the quiz area.
     * It uses event delegation to determine what was clicked and calls the appropriate function.
     * @param {Event} event - The master click event.
     */
    handleQuizContentClick(event) {
        // 'event.target' is the actual element that was clicked (e.g., the specific <i> icon).
        const target = event.target;

        // Check if the clicked element (or its parent) is a submit button.
        if (target.matches('.submit-btn')) {
            console.log("Delegated click detected on a submit button.");
            // We pass the event object to handleSubmitClick so it can get the button.
            this.handleSubmitClick(event);
        }
        
        // Check if the clicked element is a flag icon.
        if (target.matches('.flag-icon')) {
            console.log("Delegated click detected on a flag icon.");
            this.handleFlagToggle(event);
        }

        // Check if the clicked element is an explain icon.
        if (target.matches('.explain-icon')) {
            console.log("Delegated click detected on an explain icon.");
            this.handleExplainClick(event);
        }
    }
    
    /*
    ==========================================================================
    --- 3. PRIMARY EVENT HANDLERS (Direct User Interactions) --- 
    Methods that are directly called when the user interacts with main UI elements.
    ==========================================================================
    */

    /**
     * Handles file upload, parses questions, validates them, displays them,
     * and sets up dynamic event listeners.
     * Now also resets chat histories when new files are uploaded.
     * @param {Event} event - The file input change event.
     */
    async handleFileUpload(event) {
        // --- Reset Chat Histories ---
        // Clear any existing chat histories from previous sessions/files.
        this.chatHistories = {};
        console.log("handleFileUpload: Chat histories have been reset.");

        const files = event.target.files;
        if (!files || files.length === 0) {
            console.log("handleFileUpload: No files selected.");
            return;
        }
        console.log(`handleFileUpload: Processing ${files.length} file(s)...`);
    
        let allParsedQuestions = [];
        let fileReadPromises = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.name.endsWith('.txt') && file.type === 'text/plain') {
                 fileReadPromises.push(this.readFileContent(file).catch(e => ({ error: e, fileName: file.name })));
            } else {
                 console.warn(`handleFileUpload: Skipping non-TXT file: ${file.name}`);
            }
        }
    
        try {
            const fileContents = await Promise.all(fileReadPromises);
            let combinedRawText = "";
            fileContents.forEach((content) => {
                 if (content.error) {
                      console.error(`handleFileUpload: Error reading file ${content.fileName}:`, content.error);
                      alert(`Could not read file: ${content.fileName}. Skipping.`);
                 } else {
                    combinedRawText += content + "\n\n"; 
                 }
            });
            console.log("handleFileUpload: Combined raw text length:", combinedRawText.length);
            combinedRawText = combinedRawText.trim();
    
            try {
                console.log("handleFileUpload: Calling processQuestions...");
                const parsedFromCombined = processQuestions(combinedRawText); 
                console.log("handleFileUpload: processQuestions returned:", parsedFromCombined);
    
                if (parsedFromCombined !== null && typeof parsedFromCombined !== 'undefined') {
                     console.log("handleFileUpload: Assigning parsed questions to allParsedQuestions.");
                    allParsedQuestions = parsedFromCombined; 
                } else {
                     console.log("handleFileUpload: processQuestions returned null or undefined value. Resetting displays.");
                     resetDisplays(0); // Assuming resetDisplays is a global function from ui.js or part of ExamManager
                     return; 
                }
            } catch (error) {
                console.error('handleFileUpload: Error during processQuestions call:', error);
                alert('An error occurred while parsing the questions.');
                resetDisplays(0);
                return;
            }
    
            console.log("handleFileUpload: Value of allParsedQuestions before length check:", allParsedQuestions);
    
            if (!Array.isArray(allParsedQuestions)) {
                console.error("handleFileUpload: Error - allParsedQuestions is not an array! Value:", allParsedQuestions);
                alert("An internal error occurred after parsing. Check console.");
                resetDisplays(0);
                return;
            }
    
            if (allParsedQuestions.length === 0) {
                 console.log("handleFileUpload: allParsedQuestions array is empty. Alerting user.");
                alert("No valid questions were successfully parsed from the selected file(s). Check file format and console logs.");
                resetDisplays(0);
                return; 
            }
    
            console.log(`handleFileUpload: Total valid questions parsed: ${allParsedQuestions.length}. Storing for retakes.`);
            
            // 1. Store the clean, original set of questions. The spread operator '[...array]' to create a true copy, not just a reference.
            this.originalQuestions = [...allParsedQuestions];
            
            // 2. Calling function (.startNewQuiz) to start the quiz for the first time.
            this.startNewQuiz(this.originalQuestions);
    
        } catch (error) {
             console.error('handleFileUpload: General error in outer try block:', error);
            alert('An unexpected error occurred while processing the files.');
            if (typeof resetDisplays === 'function') {
                resetDisplays(0);
            }
        }
         if(event && event.target) {
            event.target.value = null; // Clear the file input
            console.log("handleFileUpload: File input value cleared.");
         }
    }

    /**
     * The primary method for starting any quiz, whether it's the full exam or a review session.
     * It takes an array of questions, sets up the state, and renders the UI.
     * @param {Array} questionsToStart - The array of question objects to begin the quiz with.
     */
    startNewQuiz(questionsToStart) {
        console.log(`Starting a new quiz with ${questionsToStart.length} questions.`);
        
        // 1. Ensure the modal is hidden and the main header is visible.
        const modalContainer = document.getElementById('end-of-quiz-modal-container');
        if (modalContainer) modalContainer.classList.remove('show');
        const headerControls = document.querySelector('.header-controls');
        if (headerControls) headerControls.style.display = 'flex';

        // 2. Set up the quiz state with the provided questions.
        this.questions = this.shuffleArray(questionsToStart);
        this.renumberQuestions();

        // 3. Initialize tracking properties for this new quiz session.
        this.questions.forEach(question => {
            question.wasAnsweredIncorrectly = false;
            question.isFlaggedForReview = false;
        });

        // 4. Reset scores and progress trackers.
        this.totalQuestions = this.questions.length;
        this.answeredQuestions = 0;
        this.currentScore = 0;
        
        // 5. Reset and display all UI elements (progress bar, timer, etc.).
        resetDisplays(this.totalQuestions);
        this.resetTimer();

        // 6. Render the new questions to the page.
        const htmlContent = displayQuestions(this.questions); 
        const quizContentElement = document.getElementById('quiz-content');
        if (quizContentElement) {
            quizContentElement.innerHTML = htmlContent;
            console.log("SUCCESS: Injected new HTML into #quiz-content.");
        } else {
            console.error("CRITICAL: Could not find #quiz-content div. Questions cannot be displayed.");
        }

        // 7. Configure and start the timer.
        this.startTimer();
        this._updateTimerControlEventsUI();
    }

    /**
     * Filters for questions that were either flagged or answered incorrectly,
     * and then starts a new, active quiz session with only those questions.
     */
    initiateReviewQuiz() {
        console.log("Initiating active review quiz for flagged and incorrect questions.");

        // 1. Filter the master list of questions to find the ones the user struggled with.
        // A question is included if it was flagged OR if it was answered incorrectly.
        const questionsToReview = this.questions.filter(
            q => q.isFlaggedForReview || q.wasAnsweredIncorrectly
        );

        // 2. Check if there are any questions to review.
        if (questionsToReview.length === 0) {
            // If the user got a perfect score and didn't flag anything, show a positive message.
            alert("There are no flagged or incorrect questions to review. Great job!");
            return; // Exit the function if there's nothing to review.
        }

        // 3. The magic happens here. We hand off the filtered list of questions
        //    to our powerful, reusable startNewQuiz function. It will handle everything:
        //    - Hiding the modal
        //    - Resetting the score and progress bars
        //    - Shuffling and re-rendering the UI with the review questions
        //    - Re-initializing all necessary event listeners for an active quiz
        this.startNewQuiz(questionsToReview);
    }

    /**
     * Handles clicks on the timer toggle button
     */
    handleTimerToggleClick() {
        this.isTimerEnabled = !this.isTimerEnabled;
        console.log("Timer global enabled state:", this.isTimerEnabled);

        const timerToggleButton = document.getElementById('timerToggleButton');
        if (timerToggleButton) {
        this.updateTimerToggleButtonVisuals(timerToggleButton);
        }

        if (!this.isTimerEnabled) {
            if (this.isTimerRunning && !this.isTimerPaused) {
                // If it was running, effectively pause it internally when disabled globally
                this.isTimerPaused = true; // Mark as paused so resume is possible if re-enabled
                // The stopTimer() will clear the interval
            }
            this.stopTimer(); 
        } else {
            console.log("Timer globally enabled. Control button states will be updated.");
        }
        this.updateTimerDisplay();
        this._updateTimerControlEventsUI(); // NEW: Update buttons based on master toggle
    }

    /**
     * Handles submit button clicks for a question.
     * Now determines input type (radio/checkbox) and processes accordingly.
     * @param {Event} event - Click event from the submit button.
     */
    handleSubmitClick(event) {
        const submitButton = event.target;
        const questionNumber = parseInt(submitButton.getAttribute('data-question'), 10);
        const container = document.getElementById(`container-${questionNumber}`);
        const feedbackElement = document.getElementById(`feedback-${questionNumber}`);
        const answerFieldset = document.getElementById(`answers-${questionNumber}`);

        // << NEW >>: Determine input type from fieldset data attribute
        const inputType = answerFieldset.getAttribute('data-input-type');
        if (!inputType) {
            console.error(`Could not determine input type for question ${questionNumber}`);
            return;
        }

        // Find question data (unchanged)
        const questionData = this.questions.find(q => q.number === questionNumber);
        if (!questionData) { /* ... error handling ... */ return; }

        // Get selected values based on input type
        let selectedLetters = [];
        if (inputType === 'radio') {
            const checkedRadio = answerFieldset.querySelector('input[type="radio"]:checked');
            if (checkedRadio) {
                selectedLetters.push(checkedRadio.value); // Array with 0 or 1 item
            }
        } else { // 'checkbox'
            const checkedCheckboxes = answerFieldset.querySelectorAll('input[type="checkbox"]:checked');
            selectedLetters = Array.from(checkedCheckboxes).map(cb => cb.value);
        }

        console.log(`Question ${questionNumber} (${inputType}) submitted. Selected: ${selectedLetters.join(', ') || 'None'}. Correct: ${questionData.correct.join(', ')}`);

        // --- Evaluation Logic (Unchanged - compares sorted arrays) ---
        const sortedSelected = [...selectedLetters].sort();
        const sortedCorrect = [...questionData.correct].sort();
        const isCorrect = sortedSelected.length === sortedCorrect.length &&
                          sortedSelected.every((value, index) => value === sortedCorrect[index]);

        // --- Disable Inputs & Show Feedback ---
        this.disableQuestionInputs(answerFieldset, submitButton, inputType);
        this.showFeedback(container, feedbackElement, isCorrect, questionData.correct, inputType);

        // --- Update Progress  ---
        this.answeredQuestions++;
        if (isCorrect) {
            this.currentScore++;
        } else {
        // If the answer is incorrect, we set our new property to true.
        // This allows us to easily find all incorrect questions later for the review session.
        questionData.wasAnsweredIncorrectly = true;
        console.log(`Question ${questionNumber} marked as incorrect.`); 
        }

        // Call UI update functions
        updateScoreDisplay(this.currentScore, this.answeredQuestions, this.totalQuestions);
        updateProgressBar(this.answeredQuestions, this.totalQuestions);

        // Check for quiz completion
        if (this.answeredQuestions === this.totalQuestions) {
            this.handleQuizCompletion();
        }
    }


    /**
     * Handles clicks on the "Explain (✨)" icon for a question.
     * This function now correctly handles the icon's state without changing its text content.
     * @param {Event} event - The click event generated by the user's click on the icon.
     */
    async handleExplainClick(event) {
        event.preventDefault();

        const icon = event.target;
        const questionNumber = parseInt(icon.getAttribute('data-question-number'), 10);
        const responseArea = document.getElementById(`llm-response-${questionNumber}`);

        if (icon.classList.contains('disabled')) {
            return;
        }
        icon.classList.add('disabled');
        
        if (responseArea) {
            responseArea.innerHTML = '<em>Requesting explanation from LLM...</em>';
            responseArea.style.display = 'block';
        } else {
            console.error(`handleExplainClick: Response area for question ${questionNumber} not found!`);
            icon.classList.remove('disabled');
            return;
        }

        const llmConfig = {
            model: document.getElementById('llmModelSelect').value,
            apiKey: document.getElementById('llmApiKeyInput').value
        };
        const questionData = this.questions.find(q => q.number === questionNumber);
        if (!questionData) {
            if (responseArea) responseArea.textContent = 'Error: Could not find question data.';
            icon.classList.remove('disabled');
            return;
        }

        let rawExplanationMarkdown = ''; 
        try {
            rawExplanationMarkdown = await this.getLlmExplanation(questionData.text, questionData.answers, llmConfig);
    
            if (responseArea) {
                responseArea.innerHTML = typeof marked !== 'undefined' ? marked.parse(rawExplanationMarkdown) : rawExplanationMarkdown;
            }
    
            const questionContainer = document.getElementById(`container-${questionNumber}`);
            if (questionContainer) {
                const existingContinueBtn = questionContainer.querySelector('.continue-discussion-btn');
                if (existingContinueBtn) existingContinueBtn.remove();
    
                const continueButton = document.createElement('button');
                continueButton.classList.add('continue-discussion-btn');
                continueButton.textContent = 'Continue Discussion';
                
                if (responseArea) {
                    responseArea.insertAdjacentElement('afterend', continueButton);
                } 
                
                continueButton.addEventListener('click', () => {
                    this.initiateChatInterface(questionNumber, rawExplanationMarkdown);
                });
            }

        } catch (error) {
            console.error(`handleExplainClick: An error occurred while fetching explanation:`, error);
            if (responseArea) {
                responseArea.innerHTML = `<p style="color:var(--error-color);">Sorry, an error occurred.</p>`;
            }
        } finally {
            icon.classList.remove('disabled');
        }

        // --- "Continue Discussion" Button Logic (Existing) ---
        // Remove any existing "Continue Discussion" button first
        const questionContainer = document.getElementById(`container-${questionNumber}`);
        if (questionContainer) {
            const existingContinueBtn = questionContainer.querySelector('.continue-discussion-btn');
            if (existingContinueBtn) {
                console.log(`handleExplainClick: Removing existing 'Continue Discussion' button for question ${questionNumber}.`);
                existingContinueBtn.remove();
            }
        }

        const continueButton = document.createElement('button');
        continueButton.classList.add('continue-discussion-btn');
        continueButton.textContent = 'Continue Discussion';
        console.log(`handleExplainClick: Created 'Continue Discussion' button for question ${questionNumber}.`);

        // Insert after the responseArea
        if (responseArea) {
            responseArea.insertAdjacentElement('afterend', continueButton);
            console.log(`handleExplainClick: Inserted 'Continue Discussion' button after llm-response-${questionNumber}.`);
        } else {
            console.error(`handleExplainClick: Could not insert 'Continue Discussion' button as responseArea for ${questionNumber} is missing.`);
        }
        
        // Add event listener using an arrow function.
        // Crucially, pass the rawExplanationMarkdown to initiateChatInterface.
        continueButton.addEventListener('click', () => {
            console.log(`handleExplainClick: 'Continue Discussion' button clicked for question ${questionNumber}. Calling initiateChatInterface.`);
            this.initiateChatInterface(questionNumber, rawExplanationMarkdown); // Pass RAW Markdown
        });

        // Re-enable the "Explain" button and reset text
        icon.disabled = false;
        icon.textContent = 'Explain';
        console.log(`handleExplainClick: LLM interaction complete for question ${questionNumber}. 'Explain' button re-enabled.`);
    }

    /**
     * Handles sending a user's chat message.
     * It now adds the user's message to the chat history,
     * sends the entire history to the LLM via a new helper method,
     * adds the LLM's response to the history, and displays it.
     * @param {Event} event - The click event from the "Send" button in the chat interface.
     */
    async handleSendChatMessage(event) {
        const button = event.currentTarget; // The "Send" button
        const questionNumber = parseInt(button.dataset.questionNumber);
        const chatInput = document.getElementById(`chat-input-${questionNumber}`);
        
        console.log(`handleSendChatMessage: Called for question ${questionNumber}.`);

        // Retrieve LLM configuration (existing)
        const llmConfig = {
            model: document.getElementById('llmModelSelect').value,
            apiKey: document.getElementById('llmApiKeyInput').value
        };
        console.log(`handleSendChatMessage: LLM Config - Model: ${llmConfig.model}, API Key Entered: ${llmConfig.apiKey ? "[Key Entered]" : "[No Key Entered]"}`);

        if (!chatInput || !chatInput.value.trim()) {
            console.log(`handleSendChatMessage: Chat input is empty for question ${questionNumber}. No action taken.`);
            return; 
        }

        const userMessage = chatInput.value.trim();
        console.log(`handleSendChatMessage: User message for question ${questionNumber}: "${userMessage}"`);

        // --- UI Update: Display user's message and prepare for LLM response (existing) ---
        this.displayChatMessage(userMessage, 'user', questionNumber); // isHtml defaults to false, which is correct for user messages
        chatInput.value = ''; // Clear input
        chatInput.disabled = true;
        button.disabled = true;
        button.textContent = 'Sending...';
        console.log(`handleSendChatMessage: Displayed user message for question ${questionNumber}. Input/button disabled.`);

        try {
            // --- NEW: Update Chat History & Call LLM with Full History ---

            // 1. Ensure chat history is initialized for this question (defensive check)
            if (!this.chatHistories[questionNumber]) {
                console.warn(`handleSendChatMessage: Chat history for question ${questionNumber} was not initialized. Initializing now.`);
                // This case ideally shouldn't happen if initiateChatInterface always runs first.
                // If it does, we might be missing initial context. For now, just initialize.
                this.chatHistories[questionNumber] = [];
                // Consider adding system prompt here if absolutely necessary, though it's better handled by initiateChatInterface
            }

            // 2. Add User's Message to History
            this.chatHistories[questionNumber].push({ role: 'user', content: userMessage });
            console.log(`handleSendChatMessage: Added user message to chat history for question ${questionNumber}.`);
            console.log(`handleSendChatMessage: Current chat history for question ${questionNumber} (before LLM call):`, JSON.parse(JSON.stringify(this.chatHistories[questionNumber])));

            // 3. Prepare for LLM Call: Get the current history array
            const messagesArray = this.chatHistories[questionNumber];

            // 4. Call New Chat History Helper (to be implemented in Section IV)
            // This helper will take the entire conversation history.
            console.log(`handleSendChatMessage: Calling _fetchLlmChatHistoryResponse for question ${questionNumber}.`);
            const llmChatResponseMarkdown = await this._fetchLlmChatHistoryResponse(llmConfig, messagesArray);

            // 5. Add LLM's Response to History
            this.chatHistories[questionNumber].push({ role: 'assistant', content: llmChatResponseMarkdown });
            console.log(`handleSendChatMessage: Added LLM response to chat history for question ${questionNumber}.`);
            console.log(`handleSendChatMessage: Updated chat history for question ${questionNumber} (after LLM call):`, JSON.parse(JSON.stringify(this.chatHistories[questionNumber])));

            // 6. Display LLM's Response
            // Pass false for isHtml, so if the LLM returns Markdown, it gets parsed by marked.js.
            this.displayChatMessage(llmChatResponseMarkdown, 'llm', questionNumber, false);
            console.log(`handleSendChatMessage: Displayed LLM response for question ${questionNumber}.`);

        } catch (error) {
            // --- Error Handling (existing, ensure it's robust) ---
            console.error(`handleSendChatMessage: Error during sending chat message for question ${questionNumber}:`, error);
            this.displayChatMessage(`Sorry, I encountered an error processing your message: ${error.message}`, 'llm', questionNumber, false);
        } finally {
            // --- UI Finalization (existing) ---
            if (chatInput) chatInput.disabled = false;
            if (button) {
                button.disabled = false;
                button.textContent = 'Send';
            }
            // Focus the chat input again for the next message
            if(chatInput) chatInput.focus();
            console.log(`handleSendChatMessage: UI finalized for question ${questionNumber}. Input/button re-enabled. Input focused.`);
        }
    }

    /**
     * Handles clicks on a flag icon.
     * Toggles the isFlaggedForReview state for the question and updates the icon's visual style.
     * @param {Event} event - The click event from the icon.
     */
    handleFlagToggle(event) {
        const flagIcon = event.target; 
        const questionNumber = parseInt(flagIcon.dataset.questionNumber, 10);
        
        const questionData = this.questions.find(q => q.number === questionNumber);

        if (questionData) {
            // 1. Toggle the boolean state in our data model.
            questionData.isFlaggedForReview = !questionData.isFlaggedForReview;
            
            // 2. Toggle the 'flagged' CSS class to change the icon's color.
            flagIcon.classList.toggle('flagged', questionData.isFlaggedForReview);

            // 3. Toggle the Font Awesome class to switch between the outline and solid icon.
            flagIcon.classList.toggle('fa-regular', !questionData.isFlaggedForReview); // Show outline if not flagged.
            flagIcon.classList.toggle('fa-solid', questionData.isFlaggedForReview);   // Show solid if flagged.

            console.log(`Question ${questionNumber} flagged status set to: ${questionData.isFlaggedForReview}`);
        }
    }

    /*
    ==========================================================================
    --- 4. CHAT INTERFACE MANAGEMENT ---
    Methods specifically for controlling and updating the chat UI.
    ==========================================================================
    */ 

    /**
    * Initiates the chat interface for a given question.
    * Hides the initial explanation display, shows the chat container,
    * and populates the chat history with initial context and the first LLM explanation.
    * @param {number} questionNumber - The number of the question for which to initiate chat.
    * @param {string} rawExplanationMarkdown - The raw Markdown string of the initial LLM explanation.
    **/
    initiateChatInterface(questionNumber, rawExplanationMarkdown) {
        console.log(`initiateChatInterface: Called for question ${questionNumber}. Raw Markdown length: ${rawExplanationMarkdown.length}`);

        const llmResponseArea = document.getElementById(`llm-response-${questionNumber}`);
        const chatInterfaceContainer = document.getElementById(`llm-chat-interface-container-${questionNumber}`);
        const chatMessagesContainer = document.getElementById(`chat-messages-${questionNumber}`);
        const sendChatButton = document.getElementById(`send-chat-btn-${questionNumber}`);
        const chatInput = document.getElementById(`chat-input-${questionNumber}`);

        // Find and hide/remove the "Continue Discussion" button
        // It should be a sibling of llmResponseArea or within the questionContainer
        const questionContainer = document.getElementById(`container-${questionNumber}`);
        if (questionContainer) {
            const continueButton = questionContainer.querySelector('.continue-discussion-btn');
            if (continueButton) {
                console.log(`initiateChatInterface: Hiding 'Continue Discussion' button for question ${questionNumber}.`);
                continueButton.style.display = 'none'; // Or continueButton.remove();
            }
        } else {
            console.warn(`initiateChatInterface: Could not find question container for question ${questionNumber} to hide 'Continue Discussion' button.`);
        }

        // Optionally hide the initial single explanation div (llm-response)
        if (llmResponseArea) {
            console.log(`initiateChatInterface: Hiding initial llm-response area for question ${questionNumber}.`);
            llmResponseArea.style.display = 'none';
        }

        // Make the main chat interface container visible
        if (chatInterfaceContainer) {
            console.log(`initiateChatInterface: Displaying chat interface container for question ${questionNumber}.`);
            chatInterfaceContainer.style.display = 'flex'; // Use 'flex' as per your CSS styles.css
        } else {
            console.error(`initiateChatInterface: Chat interface container not found for question ${questionNumber}.`);
            return; // Cannot proceed if the chat container is missing
        }

        // Clear any previous messages from the chat messages area
        if (chatMessagesContainer) {
            console.log(`initiateChatInterface: Clearing previous messages from chat-messages-${questionNumber}.`);
            chatMessagesContainer.innerHTML = '';
        } else {
            console.error(`initiateChatInterface: Chat messages container not found for question ${questionNumber}.`);
        }

        // --- Initialize and Populate Chat History ---
        console.log(`initiateChatInterface: Initializing chat history for question ${questionNumber}.`);
        this.chatHistories[questionNumber] = []; // Initialize/reset the history array

        // Retrieve questionData to form the system context message
        const questionData = this.questions.find(q => q.number === questionNumber);
        if (questionData) {
            // Construct the system message content with the original question and answers
            const questionContextForHistory = `Original Question: "${questionData.text}"\nAnswer Options:\n${questionData.answers.map(ans => `${ans.letter}. ${ans.text}`).join('\n')}`;
            
            // Add system message to the history
            this.chatHistories[questionNumber].push({ 
                role: 'system', 
                content: questionContextForHistory 
            });
            console.log(`initiateChatInterface: Added system context message to chat history for question ${questionNumber}.`);
        } else {
            console.warn(`initiateChatInterface: Could not find questionData for question ${questionNumber} to create system context message.`);
        }

        // Add the initial LLM explanation (raw Markdown) to the history as an 'assistant' message
        this.chatHistories[questionNumber].push({
            role: 'assistant',
            content: rawExplanationMarkdown
        });
        console.log(`initiateChatInterface: Added initial LLM explanation (as 'assistant') to chat history for question ${questionNumber}.`);
        console.log(`initiateChatInterface: Current chat history for question ${questionNumber}:`, JSON.parse(JSON.stringify(this.chatHistories[questionNumber])));


        // --- Display the initial explanation as the first chat message ---
        // Pass `rawExplanationMarkdown` and `isHtml = false` so `displayChatMessage` parses it.
        console.log(`initiateChatInterface: Calling displayChatMessage to show initial LLM explanation for question ${questionNumber}.`);
        this.displayChatMessage(rawExplanationMarkdown, 'llm', questionNumber, false); // `false` because rawExplanationMarkdown needs parsing

        // Add event listener for the actual send button inside this chat interface
        // Ensure this is bound correctly and only added once, or managed if this function can be called multiple times.
        if (sendChatButton) {
            // Remove existing listener to prevent duplicates if this function could be called multiple times for the same button (defensive coding)
            // Cloning and replacing the node is a robust way to remove all listeners.
            const newSendChatButton = sendChatButton.cloneNode(true);
            sendChatButton.parentNode.replaceChild(newSendChatButton, sendChatButton);
            
            newSendChatButton.addEventListener('click', this.handleSendChatMessageBound);
            console.log(`initiateChatInterface: Event listener for send chat button (send-chat-btn-${questionNumber}) re-attached.`);
        } else {
            console.error(`initiateChatInterface: Send chat button not found for question ${questionNumber}.`);
        }
        
        // Enable chat input and send button (in case they were disabled from a previous session or error)
        if (chatInput) {
            chatInput.disabled = false;
            console.log(`initiateChatInterface: Chat input for question ${questionNumber} enabled.`);
        }
        if (sendChatButton && sendChatButton.id.startsWith('send-chat-btn-')) { // Check it's the original or newly cloned one
             const actualButton = document.getElementById(sendChatButton.id); // Get the potentially new button from DOM
             if(actualButton){
                actualButton.disabled = false;
                actualButton.textContent = 'Send';
                console.log(`initiateChatInterface: Send chat button for question ${questionNumber} enabled and text reset.`);
             }
        }
        
        // Focus the chat input
        if(chatInput) {
            chatInput.focus();
            console.log(`initiateChatInterface: Focused chat input for question ${questionNumber}.`);
        }
    }

    /**
     * Method to display a chat message
    **/
    displayChatMessage(messageText, sender, questionNumber, isHtml = false) {
        const chatMessagesContainer = document.getElementById(`chat-messages-${questionNumber}`);
        if (!chatMessagesContainer) {
            console.error(`Chat messages container not found for question ${questionNumber}`);
            return;
        }

        const messageDiv = document.createElement('div');
        messageDiv.classList.add('chat-message'); // General class for all messages
        messageDiv.classList.add(sender === 'user' ? 'chat-message-user' : 'chat-message-llm');

        if (sender === 'llm') {
            if (isHtml) {
                messageDiv.innerHTML = messageText; // Message is already HTML (e.g., initial explanation)
            } else {
                // For new LLM messages that might contain Markdown
                if (typeof marked !== 'undefined') {
                    messageDiv.innerHTML = marked.parse(messageText);
                } else {
                    messageDiv.textContent = messageText; // Fallback if marked.js is not available
                    console.warn("Marked.js library not found. Displaying new LLM chat message as plain text.");
                }
            }
        } else { // Sender is 'user'
            // User messages should always be treated as plain text to prevent XSS
            messageDiv.textContent = messageText;
        }

        chatMessagesContainer.appendChild(messageDiv);

        // Auto-scroll to the bottom to show the latest message
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    }

    /*
    ==========================================================================
     --- 5. LLM INTERACTION LOGIC ---
    Methods focused on preparing prompts and interacting with the LLM (via the helper).
    ==========================================================================
    */

    /**
     * Asynchronously gets an explanation for a given question from an LLM.
     * This method now constructs the specific prompt for an initial explanation
     * and uses the _fetchLlmSinglePromptResponse helper for the actual API call.
     * @param {string} questionText - The text of the question to explain.
     * @param {Array} questionAnswers - The array of answer objects [{letter: 'A', text: '...'}].
     * @param {object} config - Configuration object { model: string (provider), apiKey: string }.
     * @returns {Promise<string>} A promise that resolves with the explanation string or an error message.
     */
    async getLlmExplanation(questionText, questionAnswers, config) {
        // Log the request for an initial explanation.
        // 'config' here is the llmConfig containing the selected provider and API key.
        console.log("Requesting initial LLM explanation for question:", questionText);
        console.log("Using LLM provider config:", config);

        // Format the answer options into a string for inclusion in the prompt.
        const formattedAnswers = questionAnswers.map(ans => `${ans.letter}. ${ans.text}`).join('\n');
        
        const basePrompt = `**Persona:**
        Act as an expert Tutor and Subject Matter Expert. Your primary objective is to deliver highly **concise, direct, and accurate explanations** for multiple-choice questions (MCQs). The goal is to enable a test-taker to rapidly understand *precisely why* the indicated correct answer is right and *why each* incorrect option is wrong. Prioritize extreme clarity and brevity for efficient learning and review.

        **Context:**
        You will be provided with a single multiple-choice question, its answer options (labeled A, B, C, D, etc.), and the letter corresponding to the correct answer. Your task is to analyze this information and generate a focused explanation *only* for this specific question.

        **Input Specification:**
        Immediately following these instructions, the user will provide:
        1.  The multiple-choice question text.
        2.  All answer options, clearly labeled (e.g., A, B, C, D).
        3.  The letter designation of the **correct** answer (e.g., "Correct Answer: C").

        **Task:**
        Analyze the provided MCQ, options, and indicated correct answer. Generate a structured explanation following the precise format below.

        **Output Structure & Formatting:**
        * **Essential Concept (Optional - Max 1 Sentence):**
            * If a single, core principle is absolutely essential to differentiate between the correct and incorrect answers *and* can be stated in one brief sentence, include it here.
            * *If not applicable or requires more than one sentence, OMIT this section entirely.*
        * **Answer Analysis:**
            * **Correct Answer ([Letter provided by user]):** Succinctly explain *why* this option is correct. Directly reference the specific fact, calculation, reasoning, or concept that validates it. (e.g., "**C:** Correct because [brief explanation referencing key element].")
            * **Incorrect Answers:** For *each* incorrect option:
                * **[Incorrect Letter A]:** Briefly and directly state *why* it is wrong. Pinpoint the specific flaw (e.g., "**A:** Incorrect because it misinterprets term X / applies the wrong formula / is factually inaccurate regarding Y.")
                * **[Incorrect Letter B]:** Briefly and directly state *why* it is wrong. (e.g., "**B:** Incorrect because factor Z is irrelevant here / contradicts the principle of...")
                * **(Continue for all other incorrect letters)**
        * **Key Term Definition(s) (Optional):**
            * If a specific technical term *within the question or answers* is crucial for understanding the explanation *and* likely unfamiliar to a test-taker, define it very briefly.
            * Use a bulleted list if multiple terms require definition.
            * *If no terms require definition or they are common knowledge for the subject, OMIT this section entirely.*

        **Constraints & Rules:**
        * **Extreme Conciseness & Directness:** Get straight to the point. Use economical language. No introductory phrases, verbose descriptions, or unnecessary background.
        * **Accuracy:** All explanations must be factually correct and logically sound.
        * **Targeted Information:** Focus *only* on the information required to justify the correctness/incorrectness of the answers for *this specific question*.
        * **Mandatory Structure:** Strictly adhere to the "Essential Concept (Optional) -> Answer Analysis -> Key Term Definition(s) (Optional)" structure.
        * **Markdown:** Use Markdown bolding for the answer letters (e.g., **A**, **B**, **C**, **D**) in the "Answer Analysis" section.
        * **Negative Constraints:**
            * **DO NOT** restate or rephrase the provided question.
            * **DO NOT** use *any* conversational introductions, transitions, or filler (e.g., "Let's look at the options," "Okay, here's the breakdown," "This question tests...").
            * **DO NOT** add concluding remarks or summaries beyond the defined structure.
        * **Immediate Output:** Provide *only* the structured analysis immediately, without any preceding confirmation or introductory text.

        **Example Input (User would provide this after the prompt):**
        *Question:* What is the capital of France?
        *Options:*
        A) Berlin
        B) Madrid
        C) Paris
        D) Rome
        *Correct Answer:* C

        ---
        **QUESTION TO ANALYZE:**
        Question: "${questionText}"
        Options:
        ${formattedAnswers}`;

        // Use a try-catch block to handle potential errors from the _fetchLlmSinglePromptResponse call.
        try {
            // Delegate the actual API call to the new centralized helper method.
            // 'config' contains the LLM provider and API key.
            // 'basePrompt' is the fully constructed prompt string for this initial explanation.
            console.log("Calling _fetchLlmSinglePromptResponse for initial explanation...");
            const explanation = await this._fetchLlmSinglePromptResponse(config, basePrompt);
            
            // Return the text explanation received from the LLM.
            return explanation;
        } catch (error) {
            // If _fetchLlmSinglePromptResponse throws an error (e.g., API error, network issue),
            // log it and return a user-friendly error message.
            console.error('Error in getLlmExplanation while calling _fetchLlmSinglePromptResponse:', error.message);
            // This message will be displayed in the UI where the explanation was expected.
            return `Sorry, I couldn't fetch an explanation at this time. Error: ${error.message}`;
        }
    }

    /*
    ==========================================================================
    --- 6. CORE QUIZ LIFECYCLE & STATE ---
    Methods related to the overall quiz flow, question management, and scoring.
    ==========================================================================
    */

    /**
     * Re-numbers questions sequentially after shuffling.
     */
    renumberQuestions() {
        this.questions.forEach((question, index) => {
            question.number = index + 1; // Renumber starting from 1
        });
    }

    /**
     * Shuffles an array in place using the Fisher-Yates (Knuth) algorithm.
     * @param {Array} array - The array to shuffle.
     * @returns {Array} The shuffled array.
     */
    shuffleArray(array) {
        // Create a copy to avoid modifying the original array directly if needed elsewhere
        let shuffledArray = [...array];
        for (let i = shuffledArray.length - 1; i > 0; i--) {
            // Generate a random index from 0 to i
            const j = Math.floor(Math.random() * (i + 1));
            // Swap elements at indices i and j
            [shuffledArray[i], shuffledArray[j]] = [shuffledArray[j], shuffledArray[i]];
        }
        return shuffledArray;
    }

    /**
     * Handles the completion of the quiz.
     * Calculates the final score and displays it in the new modal menu.
     * @param {boolean} [timeExpired=false] - Flag indicating if completion was due to time running out.
     */
    handleQuizCompletion(timeExpired = false) {
        this.stopTimer(); // Stop the timer first.

        // Find the modal elements from the DOM.
        const modalContainer = document.getElementById('end-of-quiz-modal-container');
        const modalScoreElement = document.getElementById('modal-score');
        const modalTitle = document.getElementById('modal-title');

        // Safety check to ensure the HTML elements exist.
        if (!modalContainer || !modalScoreElement || !modalTitle) {
            console.error("End of quiz modal elements not found! Check quiz.html.");
            // Fallback to a simple alert if the modal is missing from the HTML.
            alert("Quiz Complete!"); 
            return;
        }

        // Update the title if the time expired.
        if (timeExpired) {
            modalTitle.textContent = "Time's Up!";
        }

        // Generate the detailed score message using the function from ui.js
        const scoreMessage = showFinalScore(this.currentScore, this.totalQuestions);
        // Clean up the message for better presentation inside the modal paragraph.
        modalScoreElement.innerText = scoreMessage
            .replace(/Quiz Complete!\n/g, '') // Remove redundant header.
            .replace(/─/g, ''); // Remove separator characters.

        // Add the 'show' class to the container to trigger the fade-in animation.
        modalContainer.classList.add('show');
    }

    /**
     * Initiates a review session showing all questions that were either flagged OR answered incorrectly.
     * This method is triggered by the "Review Flagged & Incorrect" button in the end-of-quiz modal.
     */
    initiateReviewSession() {
        console.log("Initiating unified review session for flagged and incorrect questions.");

        const modalContainer = document.getElementById('end-of-quiz-modal-container');
        
        // --- 1. Filter Questions ---
        // Create a new array containing only the questions where the user struggled.
        // The filter checks if either `isFlaggedForReview` OR `wasAnsweredIncorrectly` is true.
        const questionsToReview = this.questions.filter(
            q => q.isFlaggedForReview || q.wasAnsweredIncorrectly
        );

        // --- 2. Check if There Are Questions to Review ---
        if (questionsToReview.length === 0) {
            // If the user got a perfect score and didn't flag anything, give them positive feedback!
            alert("There are no flagged or incorrect questions to review. Great job!");
            return; // Stop the function here.
        }

        console.log(`Found ${questionsToReview.length} questions to review.`);
        
        // --- 3. Prepare the UI for Review Mode ---
        // Hide the modal so it's not in the way.
        if (modalContainer) {
            modalContainer.classList.remove('show');
        }
        // Hide the main header controls for a clean, focused review experience.
        const headerControls = document.querySelector('.header-controls');
        if (headerControls) {
            headerControls.style.display = 'none';
        }

        // Clear the main content area and add a header for the review session.
        const quizContentElement = document.getElementById('quiz-content');
        quizContentElement.innerHTML = '<h2 class="review-header">Reviewing Flagged & Incorrect Questions</h2>';
        
        // --- 4. Display the Filtered Questions in "Review Mode" ---
        // We pass the special isReviewMode option to our displayQuestions function.
        const reviewOptions = { isReviewMode: true };
        const reviewHtmlContent = displayQuestions(questionsToReview, reviewOptions);
        // Append the generated HTML for the review questions.
        quizContentElement.innerHTML += reviewHtmlContent;

        // The "Explain" buttons should still work in review mode.
        // We need to re-initialize their listeners because we just rewrote the HTML.
        this.initializeExplainListeners();
    }

    /* 
    ==========================================================================
    --- 7. TIMER MANAGEMENT ---
    All methods related to the quiz timer.
    ==========================================================================
    */ 

    /**
     * Configures the timer's duration based on the input field when questions are loaded.
     * This method is called when questions are loaded (e.g., in handleFileUpload).
     * It sets initialTimerDuration, timeRemaining, and isTimeInfinite by calling _configureTimerFromInput.
     * It DOES NOT start the countdown interval itself.
     */
    startTimer() { // This method is called in handleFileUpload
        console.log("startTimer: Configuring timer settings from input for newly loaded quiz.");
        
        this._configureTimerFromInput(); // Read input and set initial state

        this.updateTimerDisplay(); // Update display with configured time or "No Time Limit"
        
        // Clear any pre-existing timer interval as a safety measure.
        // The actual countdown is started by _startCountdown when the user clicks "Start".
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
            console.log("startTimer: Cleared any pre-existing timer interval during configuration.");
        }
        // Note: _updateTimerControlEventsUI() is typically called after this in handleFileUpload
    }

    /**
     * Stops the quiz timer.
     */
    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null; // Clear the interval ID
            console.log("Timer stopped.");
        }
    }

    /**
     * Resets all timer-related state variables and updates the UI.
     * Called during file upload and by the manual reset button (_resetCountdown calls this).
     */
    resetTimer() {
        console.log("resetTimer: Fully resetting timer states.");
        this.stopTimer(); // Ensures any active interval is cleared

        this.timeRemaining = 0;
        this.initialTimerDuration = 0; // Crucial: reset for fresh configuration by startTimer()
        this.isTimeInfinite = false; // Default to finite time until startTimer() evaluates input
        this.isTimerRunning = false;
        this.isTimerPaused = false;
        
        this.updateTimerDisplay(); // Update the timer's text display (e.g., to 00:00:00 or Timer OFF)
        this._updateTimerControlEventsUI(); // Update the Start/Pause/Reset buttons' states
        console.log("resetTimer: Timer states have been fully reset.");
    }

    /**
     * Updates the timer display element in the UI to show HH:MM:SS format.
     */
    updateTimerDisplay() {
        const timerElement = document.getElementById('timer-display');
        if (!timerElement) return;

        // --- Handle disabled state ---
        if (!this.isTimerEnabled) {
            timerElement.textContent = 'Timer OFF';
            return;
        }

        // Ensure timeRemaining doesn't go below zero for display purposes
        const displayTime = Math.max(0, this.timeRemaining);

        // Calculate hours, minutes, and seconds
        const hours = Math.floor(displayTime / 3600);
        const minutes = Math.floor((displayTime % 3600) / 60);
        const seconds = displayTime % 60;

        // Format each part to always have two digits using padStart
        const formattedHours = String(hours).padStart(2, '0');
        const formattedMinutes = String(minutes).padStart(2, '0');
        const formattedSeconds = String(seconds).padStart(2, '0');

        // Update the text content with the new HH:MM:SS format
        timerElement.textContent = `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;

        // Console log for debugging if needed
        // console.log(">>> Updating timer display to:", timerElement.textContent);
    }

    /*
    ==========================================================================
    --- 8. UI FEEDBACK & SPECIFIC INTERACTION HELPERS ---
    Smaller methods that modify specific parts of the UI or assist event handlers.
    ==========================================================================
    */

    /**
     * Disable inputs (radio/checkbox) and submit button for a specific question.
     * @param {HTMLElement} answerFieldset - The fieldset containing the inputs.
     * @param {HTMLElement} submitButton - The submit button for the question.
     * @param {string} inputType - 'radio' or 'checkbox'.
     */
    disableQuestionInputs(answerFieldset, submitButton, inputType) {
        // Select inputs based on the type determined during submit
        answerFieldset.querySelectorAll(`input[type="${inputType}"]`).forEach(input => {
            input.disabled = true;
        });
        submitButton.disabled = true;
        submitButton.textContent = 'Submitted'; // Visually indicate submission
    }

    /**
     * Show feedback, highlighting labels associated with the correct input type.
     * @param {HTMLElement} container - The question's main container div.
     * @param {HTMLElement} feedbackElement - The element to display "Correct!" or "Incorrect!".
     * @param {boolean} isCorrect - Whether the overall submission was correct.
     * @param {Array<string>} correctLetters - Array of the correct answer letters.
     * @param {string} inputType - 'radio' or 'checkbox'.
     */
    showFeedback(container, feedbackElement, isCorrect, correctLetters, inputType) {
        console.log("showFeedback called. isCorrect:", isCorrect, "Correct Letters:", correctLetters, "Input Type:", inputType);
        // Set overall feedback text and class
        feedbackElement.textContent = isCorrect ? 'Correct!' : 'Incorrect!';
        feedbackElement.className = `feedback ${isCorrect ? 'correct' : 'incorrect'}`;

        // Iterate through each answer option container within the question
        container.querySelectorAll('.answer-option').forEach(optionDiv => {

            // Add console logs for debugging 
            console.log("Processing optionDiv HTML:", optionDiv.innerHTML);
            // Find the input element within this specific answer option div
            const input = optionDiv.querySelector(`input[type="${inputType}"]`);
            // Find the label element within this specific answer option div
            const label = optionDiv.querySelector('.answer-label');
            // Log whether the elements were found
            console.log("Found input element:", input);
            console.log("Found label element:", label);

            // Check if either input or label element was NOT found
            if (!input || !label) {
                 console.warn("Loop iteration skipped: Couldn't find input or label.");
                 return; // Skip this iteration if elements aren't found
            }

            // Get the value (answer letter) and checked state from the input
            const letter = input.value;
            const isChecked = input.checked;
            // Check if this answer's letter is one of the correct answers
            const isCorrectLetter = correctLetters.includes(letter);

            // Log details for debugging the logic
            console.log(`Processing --> Letter: ${letter}, User Checked: ${isChecked}, Is Correct Answer: ${isCorrectLetter}`);

            // Reset any previous feedback classes from the label
            label.classList.remove('correct', 'incorrect', 'missed');

            // Apply the appropriate feedback class based on whether the user checked it
            // and whether it was actually a correct answer.
            if (isChecked) { // If this option was selected by the user
                if (isCorrectLetter) {
                    // User selected it AND it was correct
                    label.classList.add('correct');
                } else {
                    // User selected it BUT it was incorrect
                    label.classList.add('incorrect');
                }
            } else { 
                if (isCorrectLetter) {
                    label.classList.add('missed');
                }
            }
        });
    }

    /**
     * Disables all remaining interactive elements (inputs, submit, explain) in the quiz.
     * Uses the common class '.answer-input' added in ui.js.
     */
    disableAllInputs() {
        // Disable all answer inputs that aren't already disabled
        document.querySelectorAll('.answer-input:not(:disabled)').forEach(input => {
            input.disabled = true;
        });
        // Disable all submit buttons that aren't already disabled
        document.querySelectorAll('.submit-btn:not(:disabled)').forEach(button => {
            button.disabled = true;
            button.textContent = 'Time Up / Finished'; // Update text
        });
         // Optionally disable explain buttons too
         document.querySelectorAll('.explain-btn:not(:disabled)').forEach(button => {
              button.disabled = true;
         });
        console.log("All remaining quiz inputs disabled.");
    }

    /**
     * --- Updates toggle button text and class based on state ---
     * @param {HTMLElement} button - The toggle button element.
     */
     updateTimerToggleButtonVisuals(button) {
         if (this.isTimerEnabled) {
             button.textContent = 'ON';
             button.classList.remove('timer-off');
         } else {
             button.textContent = 'OFF';
             button.classList.add('timer-off');
         }
     }


    /* 
    ==========================================================================
    --- 9. "PRIVATE" HELPER METHODS ---
    Internal utility methods: LLM implementation and timer controls
    ==========================================================================
    */

    /**
     * Handle file upload, parse, validate, display, and set up dynamic listeners.
     * Includes added console logs for debugging.
     * Read file as text
     */
    readFileContent(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('File reading failed'));
            reader.readAsText(file);
        });
    }

    // --- HELPER METHOD FOR LLM CHAT HISTORY API CALLS ---
    /**
     * Private helper method to make API calls to the selected LLM provider using chat history.
     * This method now dynamically handles Ollama models selected from the UI.
     * @param {object} llmConfig - Configuration for the LLM { model: string (e.g., "ollama/mistral:latest", "gemini-2.0-flash"), apiKey: string }.
     * @param {Array<Object>} messagesArray - Array of message objects {role: string, content: string}.
     * @returns {Promise<string>} A promise that resolves with the LLM's raw Markdown text response.
     * @throws {Error} If the API call fails or the response format is unexpected.
     */
    async _fetchLlmChatHistoryResponse(llmConfig, messagesArray) {
        // This variable will store the final text response from the LLM.
        let textResponse = '';

        // Ensure messagesArray is not empty before proceeding, as it's crucial for chat history.
        if (!messagesArray || messagesArray.length === 0) {
            console.error("_fetchLlmChatHistoryResponse: messagesArray is empty. Cannot make API call.");
            throw new Error("Cannot send an empty message list to the LLM.");
        }

        // Log the attempt to fetch, showing which provider/model is selected from the config
        // and the number of messages in the history.
        console.log(`_fetchLlmChatHistoryResponse: Attempting response. Provider/Model from config: ${llmConfig.model}. Messages in history: ${messagesArray.length}`);
        // Log the last message for context, useful for debugging.
        if (messagesArray.length > 0) {
            console.log(`_fetchLlmChatHistoryResponse: Last message - Role: ${messagesArray[messagesArray.length - 1].role}, Content Snippet: "${messagesArray[messagesArray.length - 1].content.substring(0, 100)}..."`);
        }

        // --- Check if the selected model is an Ollama model based on the "ollama/" prefix ---
        let isOllamaCall = false;
        let specificOllamaModelName = null; // To store the actual Ollama model name like "mistral:latest"

        if (llmConfig.model && llmConfig.model.startsWith('ollama/')) {
            isOllamaCall = true;
            // If it's an Ollama model, extract the model name part after "ollama/"
            // For example, if llmConfig.model is "ollama/mistral:latest", specificOllamaModelName will be "mistral:latest"
            specificOllamaModelName = llmConfig.model.substring('ollama/'.length);
            console.log(`_fetchLlmChatHistoryResponse: Detected Ollama call. Specific model to use: ${specificOllamaModelName}`);
        }

        // --- Handle Ollama calls separately if detected ---
        if (isOllamaCall) {
            // Define the local Ollama API endpoint for chat conversations.
            const ollamaEndpoint = 'http://localhost:11434/api/chat';
            // Use the dynamically extracted model name for the API call.
            const modelNameForApi = specificOllamaModelName;

            console.log(`_fetchLlmChatHistoryResponse: Calling Ollama (Model: ${modelNameForApi}) via /api/chat endpoint.`);

            try {
                // Make the asynchronous POST request to the Ollama /api/chat endpoint.
                const response = await fetch(ollamaEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: modelNameForApi,    // Send the specific model name
                        messages: messagesArray, // Send the entire chat history
                        stream: false            // We want the full response
                    }),
                });

                // Check if the HTTP response status indicates an error.
                if (!response.ok) {
                    let errorBody = await response.text();
                    try { const errorJson = JSON.parse(errorBody); if (errorJson && errorJson.error) { errorBody = errorJson.error; } } catch (e) { /* ignore parsing error */ }
                    console.error(`_fetchLlmChatHistoryResponse: Ollama API /api/chat request failed (${response.status}):`, errorBody);
                    throw new Error(`Ollama API Error (${response.status}): ${errorBody}`);
                }
                
                const data = await response.json();
                // For Ollama's /api/chat, the response is usually in data.message.content
                if (data.message && data.message.content) {
                    textResponse = data.message.content.trim();
                } else {
                    console.error("_fetchLlmChatHistoryResponse: Unexpected response structure from Ollama /api/chat (missing 'message.content'):", data);
                    textResponse = 'Error: Empty or unexpected response from Ollama chat.';
                }
                console.log(`_fetchLlmChatHistoryResponse: Ollama /api/chat response received. Length: ${textResponse.length}`);
            
            } catch (error) { // Catch network errors or errors from the 'throw' statements above.
                 console.error(`_fetchLlmChatHistoryResponse: Error during Ollama /api/chat call for model ${modelNameForApi}:`, error);
                 throw error; // Re-throw to be handled by the calling function (handleSendChatMessage)
            }
        } else {
            // --- If not an Ollama call, proceed with the existing switch statement for other providers ---
            console.log(`_fetchLlmChatHistoryResponse: Not an Ollama call. Processing model "${llmConfig.model}" with switch statement.`);
            // Use a switch statement to handle logic specific to each other LLM provider.
            switch (llmConfig.model) {
                // The 'ollama' case from your original code is now effectively handled by the 'if (isOllamaCall)' block.

                case 'gemini-2.0-flash': { // Matches the value from your llmModelSelect
                    // (This is your existing Gemini logic, ensure it's complete and correct)
                    if (!llmConfig.apiKey) {
                        console.error("_fetchLlmChatHistoryResponse: API Key required for Google Gemini model.");
                        throw new Error("API Key required for Google Gemini model.");
                    }
                    const geminiModelName = llmConfig.model; 
                    const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModelName}:generateContent?key=${llmConfig.apiKey}`;
                    console.log(`_fetchLlmChatHistoryResponse: Calling Gemini (Model: ${geminiModelName}) for chat history.`);

                    let systemInstruction = null;
                    let historyForGeminiContents = messagesArray; 

                    if (messagesArray.length > 0 && messagesArray[0].role === 'system') {
                        systemInstruction = { parts: [{ text: messagesArray[0].content }] };
                        historyForGeminiContents = messagesArray.slice(1); 
                        console.log("_fetchLlmChatHistoryResponse: Extracted system instruction for Gemini from the first message.");
                    }
                    
                    const geminiFormattedMessages = convertMessagesToGeminiFormat(historyForGeminiContents); // Make sure convertMessagesToGeminiFormat is available

                    const requestBody = {
                        contents: geminiFormattedMessages,
                    };

                    if (systemInstruction) {
                        requestBody.systemInstruction = systemInstruction;
                        console.log("_fetchLlmChatHistoryResponse: Applying systemInstruction to Gemini request.");
                    }

                    const response = await fetch(geminiEndpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(requestBody),
                    });

                    if (!response.ok) {
                        let errorMsg = `_fetchLlmChatHistoryResponse: Gemini API request failed (${response.status})`;
                        try { const errorData = await response.json(); if (errorData && errorData.error && errorData.error.message) { errorMsg += `: ${errorData.error.message}`; } } catch (e) {/*ignore parsing error*/}
                        console.error(errorMsg);
                        throw new Error(errorMsg);
                    }
                    const data = await response.json();
                    if (data.candidates && data.candidates.length > 0 &&
                        data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts.length > 0 &&
                        data.candidates[0].content.parts[0].text) {
                        textResponse = data.candidates[0].content.parts[0].text.trim();
                    } else {
                        let blockReasonDetail = "No specific block reason found in response.";
                        if (data.promptFeedback?.blockReason) {
                            blockReasonDetail = `Reason: ${data.promptFeedback.blockReason}.`;
                            if (data.promptFeedback.safetyRatings && data.promptFeedback.safetyRatings.length > 0) {
                                blockReasonDetail += ` Safety Ratings: ${JSON.stringify(data.promptFeedback.safetyRatings)}`;
                            }
                        } else if (data.candidates && data.candidates.length > 0 && data.candidates[0].finishReason && data.candidates[0].finishReason !== "STOP") {
                             blockReasonDetail = `Finish Reason: ${data.candidates[0].finishReason}.`;
                             if (data.candidates[0].safetyRatings && data.candidates[0].safetyRatings.length > 0) {
                                 blockReasonDetail += ` Safety Ratings: ${JSON.stringify(data.candidates[0].safetyRatings)}`;
                             }
                        }
                        console.error(`_fetchLlmChatHistoryResponse: Gemini request potentially blocked or empty response. ${blockReasonDetail} Full response:`, data);
                        throw new Error(`Gemini request blocked or yielded empty content for chat. ${blockReasonDetail} Please revise your input or check safety settings.`);
                    }
                    console.log(`_fetchLlmChatHistoryResponse: Gemini chat response received. Length: ${textResponse.length}`);
                    break;
                }

                case 'perplexity': {
                    // (This is your existing Perplexity logic, including the role alternation fix)
                    if (!llmConfig.apiKey) {
                        console.error("_fetchLlmChatHistoryResponse: API Key required for Perplexity model.");
                        throw new Error("API Key required for Perplexity model.");
                    }
                    const perplexityEndpoint = 'https://api.perplexity.ai/chat/completions';
                    const perplexityModelName = "sonar"; // As per your confirmation for the API
                    
                    console.log(`_fetchLlmChatHistoryResponse: Calling Perplexity. Config model from UI: "${llmConfig.model}", Using API Model ID: "${perplexityModelName}".`);

                    let messagesForApi = [...messagesArray]; 
                    if (messagesForApi.length >= 2 &&
                        messagesForApi[0].role === 'system' &&
                        messagesForApi[1].role === 'assistant') {
                        console.warn(`_fetchLlmChatHistoryResponse (Perplexity): Original message sequence starts [system, assistant, ...]. Adjusting for API call.`);
                        messagesForApi.splice(1, 1); 
                        console.log("_fetchLlmChatHistoryResponse (Perplexity): Messages for API after adjustment:", JSON.stringify(messagesForApi, null, 2));
                        if (messagesForApi.length === 1 && messagesForApi[0].role === 'system') {
                            console.error("_fetchLlmChatHistoryResponse (Perplexity): After adjustment, only a system message remains. Invalid API call.");
                            throw new Error("Cannot send only a system message to Perplexity after adjustment.");
                        }
                    }

                    const requestPayload = {
                        model: perplexityModelName,
                        messages: messagesForApi, 
                    };
                    console.log("_fetchLlmChatHistoryResponse: Perplexity request payload (final for chat):", JSON.stringify(requestPayload, null, 2));

                    const response = await fetch(perplexityEndpoint, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${llmConfig.apiKey}`,
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                        },
                        body: JSON.stringify(requestPayload),
                    });

                    if (!response.ok) {
                        let errorMsg = `_fetchLlmChatHistoryResponse: Perplexity API request failed (${response.status})`;
                        let errorDetail = response.statusText || "Could not retrieve error details from response header.";
                        try {
                            const errorData = await response.json();
                            console.error("_fetchLlmChatHistoryResponse: Perplexity API error response body:", errorData);
                            if (errorData && errorData.detail) { if (typeof errorData.detail === 'string') { errorDetail = errorData.detail;} else if (errorData.detail.message) { errorDetail = errorData.detail.message;} else { errorDetail = JSON.stringify(errorData.detail);}} else if (errorData && errorData.error && errorData.error.message) { errorDetail = errorData.error.message;}
                        } catch (e) {
                            try { errorDetail = await response.text(); console.error("_fetchLlmChatHistoryResponse: Perplexity API error response raw text:", errorDetail); } catch (e_text) { console.error("_fetchLlmChatHistoryResponse: Could not parse Perplexity error as JSON or get raw text.");}
                        }
                        errorMsg += `: ${errorDetail}`;
                        console.error(errorMsg);
                        throw new Error(errorMsg);
                    }
                    const data = await response.json();
                    if (data.choices && data.choices.length > 0 &&
                        data.choices[0].message && data.choices[0].message.content) {
                        textResponse = data.choices[0].message.content.trim();
                    } else {
                        console.error("_fetchLlmChatHistoryResponse: Unexpected Perplexity response format (no content):", data);
                        throw new Error('Error: Unexpected response format from Perplexity (no content from chat).');
                    }
                    console.log(`_fetchLlmChatHistoryResponse: Perplexity chat response received. Length: ${textResponse.length}`);
                    break;
                }

                case 'none':
                    console.log("_fetchLlmChatHistoryResponse: 'none' selected for LLM model. No API call made for chat.");
                    textResponse = "Please select an LLM model to continue the chat.";
                    break;

                default:
                     // This default case will only be triggered if llmConfig.model is not "ollama/...",
                    // and not one of the other specific cases like 'gemini-2.0-flash', 'perplexity', or 'none'.
                    console.warn(`_fetchLlmChatHistoryResponse: Unsupported LLM model specified in config: ${llmConfig.model}`);
                    throw new Error(`Unsupported LLM model for chat history: ${llmConfig.model}`);
            }
        }
        // Return the successfully fetched text response.
        return textResponse;
    }
    
    /**
     * Private helper method to make API calls to the selected LLM provider for a single prompt.
     * This method now dynamically handles Ollama models selected from the UI.
     * @param {object} llmConfig - Configuration for the LLM.
     * Example: { model: 'ollama/mistral:latest' or 'gemini-2.0-flash', apiKey: 'YOUR_API_KEY_IF_NEEDED' }
     * @param {string} promptString - The fully prepared prompt string to send to the LLM.
     * @returns {Promise<string>} A promise that resolves with the LLM's text response.
     * @throws {Error} If the API call fails or the response format is unexpected.
     */
    async _fetchLlmSinglePromptResponse(llmConfig, promptString) {
        // This variable will store the final text response from the LLM.
        let textResponse = '';

        // Log the attempt to fetch, showing which provider/model is selected from the config
        // and a snippet of the prompt for debugging.
        console.log(`_fetchLlmSinglePromptResponse: Attempting response from provider/model: ${llmConfig.model}. Prompt snippet: "${promptString.substring(0, 100)}..."`);

        // --- Check if the selected model is an Ollama model based on the "ollama/" prefix ---
        let isOllamaCall = false;
        let specificOllamaModelName = null; // To store the actual Ollama model name like "mistral:latest"

        if (llmConfig.model && llmConfig.model.startsWith('ollama/')) {
            isOllamaCall = true;
            // If it's an Ollama model, extract the model name part after "ollama/"
            // For example, if llmConfig.model is "ollama/mistral:latest", specificOllamaModelName will be "mistral:latest"
            specificOllamaModelName = llmConfig.model.substring('ollama/'.length);
            console.log(`_fetchLlmSinglePromptResponse: Detected Ollama call. Specific model to use: ${specificOllamaModelName}`);
        }

        // --- Handle Ollama calls separately if detected ---
        if (isOllamaCall) {
            // Define the local Ollama API endpoint for single prompt generation.
            const ollamaEndpoint = 'http://localhost:11434/api/generate';
            // Use the dynamically extracted model name for the API call.
            const modelNameForApi = specificOllamaModelName;

            console.log(`_fetchLlmSinglePromptResponse: Calling Ollama (Model: ${modelNameForApi}) via /api/generate endpoint.`);

            try {
                // Make the asynchronous POST request to the Ollama /api/generate endpoint.
                const response = await fetch(ollamaEndpoint, {
                    method: 'POST', // HTTP method
                    headers: {
                        'Content-Type': 'application/json' // Specify that we're sending JSON data
                    },
                    body: JSON.stringify({ // Convert the JavaScript payload object to a JSON string
                        model: modelNameForApi,  // The specific Ollama model to use (e.g., "mistral:latest")
                        prompt: promptString,    // The actual prompt content for /api/generate
                        stream: false            // Request the full response at once, not as a stream
                    }),
                });

                // Check if the HTTP response status indicates an error (e.g., 4xx or 5xx).
                if (!response.ok) {
                    let errorBody = await response.text(); // Try to get more error details from the response body.
                    // Attempt to parse errorBody if it's JSON, to get a more specific error message from Ollama.
                    try {
                        const errorJson = JSON.parse(errorBody);
                        if (errorJson && errorJson.error) { errorBody = errorJson.error; }
                    } catch (e) { /* If errorBody is not JSON, use the raw text. */ }
                    console.error(`_fetchLlmSinglePromptResponse: Ollama API /api/generate request failed (${response.status}):`, errorBody);
                    // Throw an error to be caught by the calling function (e.g., getLlmExplanation).
                    throw new Error(`Ollama API Error (${response.status}): ${errorBody}`);
                }

                // If the request was successful, parse the JSON data from the response body.
                const data = await response.json();

                // Extract the LLM's text response from the 'response' field of the Ollama /api/generate JSON structure.
                if (data.response) {
                    textResponse = data.response.trim(); // Trim whitespace.
                } else {
                    console.error("_fetchLlmSinglePromptResponse: Unexpected response structure from Ollama /api/generate (missing 'response' field):", data);
                    textResponse = 'Error: Empty or unexpected response from Ollama /api/generate.';
                }
                console.log(`_fetchLlmSinglePromptResponse: Ollama /api/generate response received. Length: ${textResponse.length}`);
            
            } catch (error) { // Catch network errors or errors from the 'throw' statements above.
                 console.error(`_fetchLlmSinglePromptResponse: Error during Ollama /api/generate call for model ${modelNameForApi}:`, error);
                 throw error; // Re-throw the error to propagate it.
            }
        } else {
            // --- If not an Ollama call, proceed with the existing switch statement for other providers ---
            console.log(`_fetchLlmSinglePromptResponse: Not an Ollama call. Processing model "${llmConfig.model}" with switch statement.`);
            // Use a switch statement to handle logic specific to each other LLM provider.
            switch (llmConfig.model) {

                // ---- GEMINI CASE ----
                case 'gemini-2.0-flash': {
                    // (Your existing, complete Gemini logic for single prompts goes here)
                    // Ensure all comments from your original version are maintained or enhanced.
                    if (!llmConfig.apiKey) {
                        console.error("_fetchLlmSinglePromptResponse: API Key required for Google Gemini model.");
                        throw new Error("API Key required for Google Gemini model.");
                    }
                    const geminiModelName = llmConfig.model; // This will be "gemini-2.0-flash"
                    const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModelName}:generateContent?key=${llmConfig.apiKey}`;
                    console.log(`_fetchLlmSinglePromptResponse: Calling Gemini (Model: ${geminiModelName}).`);

                    const requestBody = {
                        contents: [{ parts: [{ text: promptString }] }],
                    };
                    
                    const response = await fetch(geminiEndpoint, { /* ... (method, headers, body: JSON.stringify(requestBody)) ... */ 
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(requestBody)
                    });

                    if (!response.ok) {
                        let errorMsg = `_fetchLlmSinglePromptResponse: Gemini API request failed: ${response.status}`;
                        try {
                            const errorData = await response.json();
                            if (errorData && errorData.error && errorData.error.message) {
                                errorMsg += `: ${errorData.error.message}`;
                            }
                        } catch (e) { /* If error response body isn't JSON, ignore. */ }
                        console.error(errorMsg);
                        throw new Error(errorMsg);
                    }
                    const data = await response.json();
                    if (data.candidates && data.candidates.length > 0 &&
                        data.candidates[0].content?.parts?.[0]?.text) {
                        textResponse = data.candidates[0].content.parts[0].text.trim();
                    } else {
                        if (data.promptFeedback?.blockReason) {
                            console.error(`_fetchLlmSinglePromptResponse: Gemini request blocked by safety settings (${data.promptFeedback.blockReason}).`);
                            throw new Error(`Gemini request blocked by safety settings (${data.promptFeedback.blockReason}).`);
                        }
                        console.error("_fetchLlmSinglePromptResponse: Unexpected Gemini response format:", data);
                        throw new Error('Error: Unexpected response format from Gemini.');
                    }
                    console.log(`_fetchLlmSinglePromptResponse: Gemini response received. Length: ${textResponse.length}`);
                    break; 
                }

                // ---- PERPLEXITY CASE ----
                case 'perplexity': {
                    // (Your existing, complete Perplexity logic for single prompts goes here)
                    // Remember Perplexity /chat/completions expects a 'messages' array even for single user prompts.
                    // Ensure all comments from your original version are maintained or enhanced.
                    if (!llmConfig.apiKey) {
                        console.error("_fetchLlmSinglePromptResponse: API Key required for Perplexity model.");
                        throw new Error("API Key required for Perplexity model.");
                    }
                    const perplexityEndpoint = 'https://api.perplexity.ai/chat/completions';
                    const perplexityModelName = "sonar"; // Or your chosen specific model for single explanations if different from chat
                    console.log(`_fetchLlmSinglePromptResponse: Calling Perplexity (Model: ${perplexityModelName}). (Original config model from UI: "${llmConfig.model}")`);

                    const messagesForSinglePrompt = [{ role: "user", content: promptString }];
                    const requestPayload = {
                        model: perplexityModelName,
                        messages: messagesForSinglePrompt,
                    };
                    console.log("_fetchLlmSinglePromptResponse: Perplexity request payload (single prompt):", JSON.stringify(requestPayload, null, 2));
                    
                    const response = await fetch(perplexityEndpoint, { /* ... (method, headers, body: JSON.stringify(requestPayload)) ... */ 
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${llmConfig.apiKey}`,
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                        },
                        body: JSON.stringify(requestPayload)
                    });

                    if (!response.ok) {
                        let errorMsg = `_fetchLlmSinglePromptResponse: Perplexity API request failed: ${response.status}`;
                        // Using the more detailed error parsing from the chat history version
                        let errorDetail = response.statusText || "Could not retrieve error details from response header.";
                        try {
                            const errorData = await response.json();
                            console.error("_fetchLlmSinglePromptResponse: Perplexity API error response body:", errorData);
                            if (errorData && errorData.detail) { if (typeof errorData.detail === 'string') { errorDetail = errorData.detail; } else if (errorData.detail.message) { errorDetail = errorData.detail.message; } else { errorDetail = JSON.stringify(errorData.detail); }} else if (errorData && errorData.error && errorData.error.message) { errorDetail = errorData.error.message; }
                        } catch (e) { try { errorDetail = await response.text(); console.error("_fetchLlmSinglePromptResponse: Perplexity API error response raw text:", errorDetail); } catch (e_text) { console.error("_fetchLlmSinglePromptResponse: Could not parse error as JSON or text."); } }
                        errorMsg += `: ${errorDetail}`;
                        console.error(errorMsg);
                        throw new Error(errorMsg);
                    }
                    const data = await response.json();
                    if (data.choices && data.choices.length > 0 &&
                        data.choices[0].message?.content) {
                        textResponse = data.choices[0].message.content.trim();
                    } else {
                        console.error("_fetchLlmSinglePromptResponse: Unexpected Perplexity response format:", data);
                        throw new Error('Error: Unexpected response format from Perplexity.');
                    }
                    console.log(`_fetchLlmSinglePromptResponse: Perplexity response received. Length: ${textResponse.length}`);
                    break; 
                }

                // ---- NO MODEL SELECTED CASE ----
                case 'none':
                    console.log("_fetchLlmSinglePromptResponse: 'none' selected for LLM model. No API call made.");
                    textResponse = "Please select an LLM model to get an explanation.";
                    break;

                // ---- DEFAULT CASE (Unsupported Model) ----
                default:
                    // This default case will only be triggered if llmConfig.model is not "ollama/...",
                    // and not "gemini-2.0-flash", "perplexity", or "none".
                    console.warn(`_fetchLlmSinglePromptResponse: Unsupported LLM model specified: ${llmConfig.model}`);
                    throw new Error(`Unsupported LLM model for single prompt: ${llmConfig.model}`);
            }
        }
        // Return the extracted text response (or error message if 'none' was selected).
        return textResponse;
    }

    /**
     * Fetches the list of available models from the local Ollama API.
     * @returns {Promise<Array<string>>} A promise that resolves with an array of model names (e.g., ["mistral:latest", "llama3:8b"]).
     * Returns an empty array if an error occurs or no models are found.
     * @private
     */
    async _fetchAvailableOllamaModels() {
        const ollamaTagsEndpoint = 'http://localhost:11434/api/tags';
        console.log("_fetchAvailableOllamaModels: Attempting to fetch models from Ollama at", ollamaTagsEndpoint);
        try {
            const response = await fetch(ollamaTagsEndpoint);
            if (!response.ok) {
                console.error(`_fetchAvailableOllamaModels: Failed to fetch Ollama models. Status: ${response.status} - ${response.statusText}`);
                // Don't alert here, allow UI to function without Ollama if it's not running.
                return []; // Return empty array on HTTP error
            }
            const data = await response.json();
            if (data && data.models && Array.isArray(data.models)) {
                const modelNames = data.models.map(model => model.name);
                console.log("_fetchAvailableOllamaModels: Successfully fetched Ollama models:", modelNames);
                return modelNames;
            } else {
                console.warn("_fetchAvailableOllamaModels: No models found or unexpected response structure from Ollama:", data);
                return []; // Return empty if no models array or unexpected structure
            }
        } catch (error) {
            console.error("_fetchAvailableOllamaModels: Error connecting to Ollama or parsing response. Ollama might not be running or reachable.", error);
            // Inform the user subtly, perhaps by not populating Ollama options or adding a disabled one.
            return []; // Return empty array on network error or other exceptions
        }
    }

    /**
     * Populates the #llmModelSelect dropdown with available Ollama models.
     * It prepends "ollama/" to the value to distinguish them and make parsing easier later.
     */
    async populateOllamaModelsDropdown() {
        console.log("populateOllamaModelsDropdown: Starting to populate Ollama models.");
        const llmModelSelect = document.getElementById('llmModelSelect');
        if (!llmModelSelect) {
            console.error("populateOllamaModelsDropdown: Could not find the #llmModelSelect dropdown element.");
            return;
        }

        const ollamaModels = await this._fetchAvailableOllamaModels();

        if (ollamaModels.length === 0) {
            console.log("populateOllamaModelsDropdown: No Ollama models fetched or Ollama not available. No new options will be added.");
            const existingOllamaOption = llmModelSelect.querySelector('option[value="ollama"]');
            if (existingOllamaOption) {
                console.log("populateOllamaModelsDropdown: Removing static 'Ollama (Local)' option as no specific models were found or Ollama is unavailable.");
                existingOllamaOption.remove();
            }
            return;
        }

        // Remove the generic "Ollama (Local)" option if it exists, as we'll add specific ones.
        const existingOllamaOption = llmModelSelect.querySelector('option[value="ollama"]');
        if (existingOllamaOption) {
            console.log("populateOllamaModelsDropdown: Removing static 'Ollama (Local)' option to replace with specific models.");
            existingOllamaOption.remove();
        }

        // Add new options for each fetched Ollama model
        ollamaModels.forEach(modelName => {
            const option = document.createElement('option');
            // Store the value with a prefix to identify it as an Ollama model and include the actual model name.
            option.value = `ollama/${modelName}`; 
            option.textContent = `Ollama | ${modelName}`; // User-friendly display text
            llmModelSelect.appendChild(option);
            console.log(`populateOllamaModelsDropdown: Added option - Value: "${option.value}", Text: "${option.textContent}"`);
        });

        console.log("populateOllamaModelsDropdown: Finished populating Ollama models.");
    }

    
    /* 
    ==========================================================================
    --- 10. "PRIVATE" HELPER METHODS ---
    Helper methods for internal timer controls
    ==========================================================================
    */

    /**
     * Updates the UI of the timer control buttons (text and enabled/disabled state).
     */
    _updateTimerControlEventsUI() {
        const startPauseResumeButton = document.getElementById('timerStartPauseResumeButton');
        const resetButton = document.getElementById('timerResetButton');

        if (!startPauseResumeButton || !resetButton) {
            console.warn("_updateTimerControlEventsUI: Control buttons not found.");
            return;
        }

        // Are the controls globally enabled by the main timer toggle?
        const controlsShouldBeEnabled = this.isTimerEnabled && !this.isTimeInfinite && this.totalQuestions > 0;

        if (!controlsShouldBeEnabled) {
            startPauseResumeButton.disabled = true;
            resetButton.disabled = true;
            startPauseResumeButton.textContent = 'Start'; // Default text when disabled
            console.log("_updateTimerControlEventsUI: Timer controls disabled (timer off, infinite, or no quiz).");
            return;
        }

        // If controls are generally allowed:
        resetButton.disabled = false; // Reset is usually always available if timer is on and finite

        if (this.isTimerRunning) {
            if (this.isTimerPaused) {
                startPauseResumeButton.textContent = 'Resume';
                startPauseResumeButton.disabled = false;
            } else {
                startPauseResumeButton.textContent = 'Pause';
                startPauseResumeButton.disabled = false;
            }
        } else { // Timer is not running (either ready to start or has been reset/finished)
            startPauseResumeButton.textContent = 'Start';
            // Enable Start button only if there's time set or time remaining
            startPauseResumeButton.disabled = !(this.initialTimerDuration > 0 || this.timeRemaining > 0) ;
        }
        console.log(`_updateTimerControlEventsUI: Start/Pause/Resume button text: "${startPauseResumeButton.textContent}", disabled: ${startPauseResumeButton.disabled}. Reset button disabled: ${resetButton.disabled}`);
    }
    
    /**
     * Handles clicks on the Start/Pause/Resume timer button.
     * This method determines the current state of the timer and calls the
     * appropriate internal method (_startCountdown, _pauseCountdown, or _resumeCountdown).
     * @param {Event} event - The click event (not directly used but good practice for event handlers).
     */
    handleTimerStartPauseResumeClick(event) {
        console.log("handleTimerStartPauseResumeClick: Button clicked.");

        // First, check if the timer is globally enabled via the main toggle button.
        // Also, these controls are not applicable if the timer is set to "No Time Limit".
        if (!this.isTimerEnabled) {
            console.warn("handleTimerStartPauseResumeClick: Timer is globally disabled. No action.");
            alert("The timer is currently OFF. Please turn it ON to use the timer controls.");
            this._updateTimerControlEventsUI(); // Ensure button states are correct
            return;
        }
        if (this.isTimeInfinite) {
            console.warn("handleTimerStartPauseResumeClick: Timer is set to 'No Time Limit'. Start/Pause/Resume controls are not applicable.");
            alert("Timer controls (Start/Pause/Resume) are not available when 'No Time Limit' is set.");
            this._updateTimerControlEventsUI(); // Ensure button states are correct
            return;
        }

        // Logic to decide whether to start, pause, or resume:
        if (!this.isTimerRunning) {
            // If the timer is not currently running (i.e., it's stopped or has been reset),
            // this button acts as a "Start" button.
            console.log("handleTimerStartPauseResumeClick: Timer is not running. Calling _startCountdown().");
            this._startCountdown();
        } else {
            // If the timer IS running, this button toggles between "Pause" and "Resume".
            if (this.isTimerPaused) {
                // If the timer is running but currently paused, this button acts as a "Resume" button.
                console.log("handleTimerStartPauseResumeClick: Timer is running and paused. Calling _resumeCountdown().");
                this._resumeCountdown();
            } else {
                // If the timer is running and NOT paused, this button acts as a "Pause" button.
                console.log("handleTimerStartPauseResumeClick: Timer is running and not paused. Calling _pauseCountdown().");
                this._pauseCountdown();
            }
        }
        // Note: The _startCountdown, _pauseCountdown, and _resumeCountdown methods
        // are responsible for calling _updateTimerControlEventsUI() to update the button's text and state.
    }

    /**
     * Handles clicks on the Reset timer button.
     * This method calls the internal _resetCountdown method to reset the timer
     * to its initially configured duration.
     * @param {Event} event - The click event (not directly used).
     */
    handleTimerResetClick(event) {
        console.log("handleTimerResetClick: Button clicked.");

        // Check if the timer is globally enabled. Resetting a disabled timer might be confusing,
        // but generally, reset should work to set it back to its initial state regardless of running status.
        // However, if it's infinite, reset also just sets it to a non-counting state.
        if (!this.isTimerEnabled) {
            console.warn("handleTimerResetClick: Timer is globally disabled. Reset will still set time but not run.");
            // Allow reset even if globally disabled, to set it back to initial state.
            // _resetCountdown will also update the button UI via _updateTimerControlEventsUI.
        }
        if (this.isTimeInfinite) {
            console.log("handleTimerResetClick: Timer is set to 'No Time Limit'. Resetting to 'No Time Limit' display and non-running state.");
            // _resetCountdown handles the isTimeInfinite case appropriately.
        }

        console.log("handleTimerResetClick: Calling _resetCountdown().");
        this._resetCountdown();
        // The _resetCountdown method calls _updateTimerControlEventsUI() to update button states.
    }

    /**
     * Starts the timer countdown. Sets up the interval to decrement timeRemaining.
     * If it's a fresh start, it re-configures the timer from the input.
     * @private
     */
    _startCountdown() {
        // Only proceed if timer is globally enabled and not already running (unless it was paused for a resume)
        if (!this.isTimerEnabled || (this.isTimerRunning && !this.isTimerPaused)) {
            if (!this.isTimerEnabled) {
                 console.warn("_startCountdown: Cannot start, timer is globally disabled.");
                 alert("The timer is currently OFF. Please turn it ON to start.");
            }
            if (this.isTimerRunning && !this.isTimerPaused) {
                console.warn("_startCountdown: Timer is already running and not paused.");
            }
            this._updateTimerControlEventsUI(); // Ensure UI is consistent
            return;
        }

        // If this is a fresh start (timer wasn't running), re-configure from input.
        // This ensures any changes to the duration input before clicking "Start" are captured.
        if (!this.isTimerRunning) {
            console.log("_startCountdown: This is a fresh start. Re-configuring timer from input.");
            this._configureTimerFromInput();
        }
        // After _configureTimerFromInput(), this.isTimeInfinite and this.timeRemaining are up-to-date.

        // If timer is set to "No Time Limit" after configuration, don't start countdown.
        if (this.isTimeInfinite) {
            console.log("_startCountdown: Timer is configured to 'No Time Limit'. No countdown will start.");
            this.updateTimerDisplay(); // Ensure "No Time Limit" or "Timer OFF" is displayed
            this._updateTimerControlEventsUI(); // Update buttons accordingly
            return;
        }

        // If, after configuration, there's no time set for a finite timer, cannot start.
        if (this.timeRemaining <= 0) {
            console.warn("_startCountdown: No timer duration (timeRemaining is 0 or less after configuration). Cannot start countdown.");
            alert("Please set a timer duration greater than 0 minutes to start the timer.");
            this.updateTimerDisplay(); // Reflects 00:00:00
            this._updateTimerControlEventsUI();
            return;
        }

        // All checks passed, proceed to start/resume the countdown.
        this.isTimerRunning = true;  // Mark timer as active
        this.isTimerPaused = false;   // Ensure not paused
        console.log(`_startCountdown: Timer countdown initiated/resumed. Time remaining: ${this.timeRemaining}s`);

        // Clear any existing interval before starting a new one (safety for resume logic)
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }

        this.updateTimerDisplay(); // Update display immediately

        this.timerInterval = setInterval(() => {
            if (this.isTimerPaused) { // Interval continues, but doesn't decrement if paused
                return;
            }

            this.timeRemaining--;
            this.updateTimerDisplay();

            if (this.timeRemaining < 0) { // Ensure it stops at 0
                this.timeRemaining = 0; // Correct to 0 if it somehow went negative
                this.updateTimerDisplay(); // Update display to show 00:00:00
                
                console.log("Timer interval: Time expired.");
                this.stopTimer(); // Clears interval
                this.isTimerRunning = false;
                this.isTimerPaused = false;
                this.disableAllInputs();
                this.handleQuizCompletion(true); // True for timeExpired
                this._updateTimerControlEventsUI();
            }
        }, 1000);

        this._updateTimerControlEventsUI(); // Update button text to "Pause", enable Reset, etc.
    }

    /**
     * Pauses the currently running timer countdown.
     * @private
     */
    _pauseCountdown() {
        if (!this.isTimerRunning || this.isTimerPaused) {
            console.log("_pauseCountdown: Timer is not running or already paused. No action.");
            return;
        }

        if (this.timerInterval) {
            clearInterval(this.timerInterval); // Stop the interval
            this.timerInterval = null;
            console.log("_pauseCountdown: Timer interval cleared (paused).");
        }
        this.isTimerPaused = true;
        // isTimerRunning remains true because the session is active, just paused.
        this._updateTimerControlEventsUI(); // Update button text to "Resume", etc.
        this.updateTimerDisplay(); // Optionally, could add a (Paused) indicator to display here
    }

    /**
     * Resumes a paused timer countdown.
     * @private
     */
    _resumeCountdown() {
        if (!this.isTimerRunning || !this.isTimerPaused) {
            console.log("_resumeCountdown: Timer is not running or not paused. No action.");
            return;
        }
        if (this.isTimeInfinite) { // Should not be able to pause/resume infinite timer
            console.log("_resumeCountdown: Cannot resume, timer is set to infinite.");
             this._updateTimerControlEventsUI();
            return;
        }

        this.isTimerPaused = false;
        console.log("_resumeCountdown: Resuming timer countdown. Time remaining:", this.timeRemaining);
        
        // Re-initiate the countdown (which sets up the interval again)
        // _startCountdown has checks to prevent re-starting if already running & not paused.
        // Here we explicitly want to restart the interval if it was paused.
        // A simpler way for resume is to just call _startCountdown's interval part.
        // For simplicity and to reuse the interval logic:
        if (this.timerInterval) { // Clear any residual interval, though _pauseCountdown should have.
            clearInterval(this.timerInterval);
        }
        // Re-use the interval logic from _startCountdown, but without resetting timeRemaining
        this.timerInterval = setInterval(() => {
            if (this.isTimerPaused) return;

            this.timeRemaining--;
            this.updateTimerDisplay();

            if (this.timeRemaining <= 0) {
                console.log("Timer interval: Time expired after resume.");
                this.stopTimer();
                this.isTimerRunning = false;
                this.isTimerPaused = false;
                this.disableAllInputs();
                this.handleQuizCompletion(true);
                this._updateTimerControlEventsUI();
            }
        }, 1000);
        
        this._updateTimerControlEventsUI(); // Update button text to "Pause", etc.
    }

    /**
     * Resets the timer to its currently configured duration (from input) and stops the countdown.
     * @private
     */
    _resetCountdown() {
        console.log("_resetCountdown: Resetting timer countdown.");
        this.stopTimer(); // Clears any active interval

        this.isTimerRunning = false; // Mark timer as not active
        this.isTimerPaused = false;  // Ensure not paused

        // Re-configure the timer from the current input value
        this._configureTimerFromInput(); 
        
        this.updateTimerDisplay();     // Update the timer's text display
        this._updateTimerControlEventsUI(); // Update control buttons (e.g., "Start" should be visible)
        console.log("_resetCountdown: Timer has been reset and re-configured from input.");
    }

    /**
     * Reads the timer duration from the input field and configures timer state.
     * Sets initialTimerDuration, timeRemaining, and isTimeInfinite.
     * @private
     */
    _configureTimerFromInput() {
        console.log("_configureTimerFromInput: Reading timer duration input and configuring timer state.");
        this.isTimeInfinite = false; // Assume finite time initially

        const durationInput = document.getElementById('timerDurationInput');
        if (!durationInput) {
            console.error("_configureTimerFromInput: Could not find timerDurationInput element!");
            // Fallback if input element is missing
            this.initialTimerDuration = 0;
            this.timeRemaining = 0;
            this.isTimeInfinite = true; // Default to no time limit if input is missing
            console.warn("_configureTimerFromInput: timerDurationInput missing, defaulting to No Time Limit.");
            return;
        }

        const inputValue = durationInput.value;
        let durationMinutes = parseInt(inputValue, 10);
        console.log(`_configureTimerFromInput: Raw input value: "${inputValue}", Parsed minutes: ${durationMinutes}`);

        // Handle "0", empty, or invalid input as "No Time Limit"
        if (isNaN(durationMinutes) || durationMinutes <= 0) {
            console.log("_configureTimerFromInput: Duration is 0 or invalid. Setting to NO TIME LIMIT.");
            this.isTimeInfinite = true;
            this.initialTimerDuration = 0; // For "no limit", these are 0
            this.timeRemaining = 0;
            // Standardize input field to "0" for "No Time Limit" state if it was invalid/empty
            if (inputValue.trim() === '' || isNaN(parseInt(inputValue, 10))) {
                durationInput.value = '0';
            } else if (parseInt(inputValue, 10) < 0) { // Ensure negative numbers also become "0"
                 durationInput.value = '0';
            }
        } else {
            console.log(`_configureTimerFromInput: Finite timer duration set to ${durationMinutes} minutes.`);
            this.isTimeInfinite = false; // Explicitly finite
            this.initialTimerDuration = durationMinutes * 60; // Store in seconds
            this.timeRemaining = this.initialTimerDuration;   // Set remaining time
        }
        console.log(`_configureTimerFromInput: Configuration complete. isTimeInfinite: ${this.isTimeInfinite}, initialTimerDuration: ${this.initialTimerDuration}s, timeRemaining: ${this.timeRemaining}s`);
    }

}

/**
 * This event listener waits for the entire HTML document to be fully loaded and parsed before it runs the code inside. This guarantees that all HTML elements, including. This fixes the unresponsiveness of our "Review" buttons at the end of our quiz
 */
document.addEventListener('DOMContentLoaded', () => {
    new ExamManager();
    console.log("DOM fully loaded and parsed. ExamManager created.");
});
