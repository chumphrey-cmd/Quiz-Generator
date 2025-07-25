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
        this.examMode = 'study';
        this.currentQuestionIndex = 0; // Used for the single-question display in Exam Mode. Initialized it to 0, representing the first question.
        this.reviewSet = []; // Array used to hold a subset of questions for focused review
        this.reviewSetIndex = 0; // Index for navigating the temporary 'reviewSet' array
        this.questions = [];
        this.originalQuestions = []; // Used to store original imported Qs
        this.timerInterval = null;
        this.timeRemaining = 0;
        const initialTimerInput = document.getElementById('timerDurationInput');
        this.timerDuration = (initialTimerInput ? parseInt(initialTimerInput.value, 10) : 10) * 60;
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
        this.handleSendChatMessageBound = this.handleSendChatMessage.bind(this);
        this.handleTimerStartPauseResumeClickBound = this.handleTimerStartPauseResumeClick.bind(this);
        this.handleTimerResetClickBound = this.handleTimerResetClick.bind(this);

        // --- Initialize Event Listeners ---
        this.initializeEventListeners();
        

        // --- Populate Ollama models ---
        this.populateOllamaModelsDropdown(); 

        // --- Initialize model descriptions on load ---
        this.initializeTooltips();

        // --- Set initial button states for timer ---
        this._updateTimerControlEventsUI();

        console.log("ExamManager constructor finished.");
    }

    /**
     * Initializes the tooltip functionality for the model selection UI.
     * It finds all model options with a data-description and dynamically creates
     * the tooltip elements needed for the CSS hover effect to work.
     */
    initializeTooltips() {
        console.log("Initializing tooltips for model selection...");
        // Find all model options that have a description.
        const modelOptions = document.querySelectorAll('.model-option[data-description]');
        
        modelOptions.forEach(option => {
            const description = option.dataset.description;
            const icon = option.querySelector('.model-info-icon');

            if (description && icon) {
                // Check if a tooltip already exists to avoid duplication.
                if (option.querySelector('.tooltip-text')) {
                    return;
                }
                
                // Create the span element that will hold the tooltip text.
                const tooltipSpan = document.createElement('span');
                tooltipSpan.classList.add('tooltip-text');
                tooltipSpan.textContent = description;
                
                // Append the tooltip span directly inside the model option container.
                // The CSS will handle showing it when the icon is hovered.
                icon.parentNode.insertBefore(tooltipSpan, icon.nextSibling);
            }
        });
        console.log(`Tooltips initialized for ${modelOptions.length} model options.`);
    }

    /* 
    ==========================================================================
    --- 2. INITIALIZATION ---
    Methods related to setting up initial state or dynamic event listeners.
    ==========================================================================
    */

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
            // This logic remains unchanged. It validates the user's input in the timer field.
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

        const modeSelector = document.getElementById('modeSelector');
        if (modeSelector) {
            // We listen for the 'change' event, which fires when the user selects a new option.
            modeSelector.addEventListener('change', (event) => {
                // The new mode is the value of the selected option (e.g., 'study' or 'exam').
                const selectedMode = event.target.value;
                console.log(`Mode selector changed. New mode selected: ${selectedMode}`);

                // If a quiz is currently active, changing the mode should reset it.
                // It's critical to warn the user first, as this will erase their progress.
                if (this.questions.length > 0) {
                    const userConfirmed = confirm(
                        'Changing the mode will restart your current session. Are you sure you want to continue?'
                    );

                    if (userConfirmed) {
                        // If the user clicks "OK", update the mode and restart the quiz.
                        console.log('User confirmed mode change. Resetting quiz.');
                        this.examMode = selectedMode;
                        // Restart the quiz from the beginning with the original set of questions.
                        this.startNewQuiz(this.originalQuestions);
                    } else {
                        // If the user clicks "Cancel", do nothing and revert the dropdown
                        // to its previous state to avoid confusion.
                        console.log('User cancelled mode change. Reverting selector.');
                        event.target.value = this.examMode;
                    }
                } else {
                    // If no quiz is active, we can just update the mode without a warning.
                    this.examMode = selectedMode;
                }
                console.log(`Current exam mode is now: '${this.examMode}'`);
            });
        } else {
            console.error("Mode selector element 'modeSelector' not found!");
        }

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


        // --- Listener for API Provider Dropdown ---
        const providerSelect = document.getElementById('apiProviderSelect');
        if (providerSelect) {
            this.handleProviderChangeBound = this.handleProviderChange.bind(this);
            providerSelect.addEventListener('change', this.handleProviderChangeBound);
        } else {
            console.error("API Provider select element 'apiProviderSelect' not found!");
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
        // This logic remains unchanged.
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

    /**
     * Handles the change event for the main API provider dropdown.
     * It shows the settings for the selected provider and hides all others.
     * @param {Event} event - The change event from the select element.
     */
    handleProviderChange(event) {
        const selectedProvider = event.target.value;
        console.log(`Provider changed to: ${selectedProvider}`);

        // First, hide all provider-specific settings containers.
        const allSettings = document.querySelectorAll('.provider-settings');
        allSettings.forEach(setting => {
            setting.style.display = 'none';
        });

        // If a provider is selected (i.e., not 'none'), show its corresponding settings panel.
        if (selectedProvider !== 'none') {
            const settingsToShow = document.getElementById(`${selectedProvider}-settings`);
            if (settingsToShow) {
                // We use 'flex' because the child elements are laid out with flexbox.
                settingsToShow.style.display = 'flex';
                console.log(`Displaying settings for: #${settingsToShow.id}`);
            }
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

        // Reset review state for a true retake
        this.reviewSet = [];
        this.reviewSetIndex = 0;
        
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
            // This array will store the user's answer(s) (e.g., ['A'] or ['B', 'D'])
            // for later grading in Exam Mode.
            question.userSelected = [];
        });

        // 4. Reset scores and progress trackers.
        this.totalQuestions = this.questions.length;
        this.answeredQuestions = 0;
        this.currentScore = 0;
        this.currentQuestionIndex = 0; // Every time a new quiz starts, we must reset the current question index
        
        // 5. Reset and display all UI elements (progress bar, timer, etc.).
        resetDisplays(this.totalQuestions);
        this.resetTimer();

        // 6. Render the new questions to the page.
        this._renderCurrentView();

        // 7. Configure and start the timer.
        this.startTimer();
        this._updateTimerControlEventsUI();
    }

    /**
     * Renders the appropriate quiz view based on the current examMode.
     * This acts as a "router" to decide whether to show the full list (Study Mode)
     * or a single question (Exam Mode).
     * @private
     */
    _renderCurrentView() {
        console.log(`_renderCurrentView: Rendering view for mode '${this.examMode}'.`);
        const quizContentElement = document.getElementById('quiz-content');
        if (!quizContentElement) {
            console.error("_renderCurrentView: Could not find #quiz-content div. Cannot render.");
            return;
        }

        let htmlContent = '';

        if (this.examMode === 'study') {
            // --- Study Mode Logic ---
            // If we are in study mode, we call the original displayQuestions function
            // to get the HTML for the entire list of questions. This part is unchanged.
            console.log("Rendering full question list for Study Mode.");
            htmlContent = displayQuestions(this.questions);

        } else {
            // --- Exam Mode Logic ---
            // Get the specific question object to display.
            const currentQuestion = this.questions[this.currentQuestionIndex];
            console.log(`Rendering single question view for Exam Mode. Question #${currentQuestion.number}`);

            // We check if a 'reviewSet' is active.
            const isReviewing = this.reviewSet.length > 0;

            // To get the text for our new descriptive counter (e.g., "Reviewing Flagged Questions"),
            // we first need to know which filter button is currently active on the review screen.
            const activeFilterButton = document.querySelector('.filter-btn.active');
            
            // We get the filter type (e.g., 'all', 'flagged') from the button's data attribute.
            // If for some reason no button is active, we default to 'all'.
            const reviewFilterType = activeFilterButton ? activeFilterButton.dataset.filter : 'all';

            // We call our UI function and pass ALL the necessary context: the question itself,
            // the total count, whether we're in a special review mode, and the type of filter active.
            htmlContent = displaySingleQuestion(currentQuestion, this.totalQuestions, isReviewing, reviewFilterType);
        }
        
        // Finally, we inject the generated HTML into the main content area of the page.
        quizContentElement.innerHTML = htmlContent;
        console.log("SUCCESS: Injected new HTML into #quiz-content.");

        // This block handles attaching the necessary event listeners after rendering.
        if (this.examMode === 'exam') {
            this._attachExamNavListeners();

            const answerFieldset = quizContentElement.querySelector('.answers');
            if (answerFieldset) {
                answerFieldset.addEventListener('change', this.handleAnswerSelection.bind(this));
            }
            
            this._updateProgress();
        }
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

        // 3. We hand off the filtered list of questions to our powerful, reusable startNewQuiz function. It will handle everything:
        //    - Hiding the modal
        //    - Resetting the score and progress bars
        //    - Shuffling and re-rendering the UI with the review questions
        //    - Re-initializing all necessary event listeners for an active quiz
        this.startNewQuiz(questionsToReview);
    }

    /**
     * Handles submit button clicks for a question.
     * Now behaves differently based on whether the application is in 'study' or 'exam' mode.
     * @param {Event} event - Click event from the submit button.
     */
    handleSubmitClick(event) {
        const submitButton = event.target;
        const questionNumber = parseInt(submitButton.getAttribute('data-question'), 10);
        const container = document.getElementById(`container-${questionNumber}`);
        const feedbackElement = document.getElementById(`feedback-${questionNumber}`);
        const answerFieldset = document.getElementById(`answers-${questionNumber}`);
        const inputType = answerFieldset.getAttribute('data-input-type');

        // Find the question object from our questions array.
        const questionData = this.questions.find(q => q.number === questionNumber);
        if (!questionData) { 
            console.error(`handleSubmitClick: Could not find data for question #${questionNumber}`);
            return;
        }

        // Get the user's selected answer(s) from the radio buttons or checkboxes.
        let selectedLetters = [];
        if (inputType === 'radio') {
            const checkedRadio = answerFieldset.querySelector('input[type="radio"]:checked');
            if (checkedRadio) {
                selectedLetters.push(checkedRadio.value);
            }
        } else { // 'checkbox'
            const checkedCheckboxes = answerFieldset.querySelectorAll('input[type="checkbox"]:checked');
            selectedLetters = Array.from(checkedCheckboxes).map(cb => cb.value);
        }
        
        console.log(`Question ${questionNumber} submitted in '${this.examMode}' mode. Selected: ${selectedLetters.join(', ')}`);

        // --- Store the user's answer ---
        // This is crucial for Exam Mode so we can grade it later.
        questionData.userSelected = selectedLetters;

        // --- Mode-Specific Logic ---
        if (this.examMode === 'study') {
            // --- STUDY MODE ---
            // Provide immediate feedback and scoring.

            console.log("Executing 'Study Mode' logic: immediate feedback and scoring.");

            // Evaluate if the answer is correct.
            const sortedSelected = [...selectedLetters].sort();
            const sortedCorrect = [...questionData.correct].sort();
            const isCorrect = sortedSelected.length === sortedCorrect.length &&
                              sortedSelected.every((value, index) => value === sortedCorrect[index]);

            // Update score and mark if incorrect.
            if (isCorrect) {
                this.currentScore++;
            } else {
                questionData.wasAnsweredIncorrectly = true;
            }
            // Visually update the score display in the header.
            updateScoreDisplay(this.currentScore, this.answeredQuestions + 1, this.totalQuestions);
            
            // Disable the inputs and show correct/incorrect feedback visually.
            this.disableQuestionInputs(answerFieldset, submitButton, inputType);
            this.showFeedback(container, feedbackElement, isCorrect, questionData.correct, inputType);

        } else {
            // --- EXAM MODE ---
            // Withhold feedback and scoring. Just acknowledge the answer.
            
            console.log("Executing 'Exam Mode' logic: withholding feedback.");
            
            // Just disable the inputs so the user can't change their answer.
            this.disableQuestionInputs(answerFieldset, submitButton, inputType);
        }

        // --- Logic for BOTH modes ---
        // An answer has been submitted, so we always update the progress bar.
        this.answeredQuestions++;
        this._updateProgress();


        // Check if the quiz is complete
        if (this.answeredQuestions === this.totalQuestions) {
            // If all questions are answered, decide what to do based on the mode.
            if (this.examMode === 'study') {
                // In 'study' mode, the quiz ends immediately and shows the modal.
                console.log("All questions answered in Study Mode. Ending quiz.");
                this.handleQuizCompletion();
            } else {
                // In 'exam' mode, we don't end the quiz. Instead, we show the grade button.
                console.log("All questions answered in Exam Mode. Displaying Grade Exam button.");
                this.displayGradeExamButton(); // This is a new method we will create next.
            }
        }
    }

    /**
     * Handles the 'change' event on any answer input when in Exam Mode.
     * Its sole purpose is to update the 'userSelected' array for the
     * current question, immediately saving the user's answer to our data state.
     * @param {Event} event - The 'change' event object from the clicked radio or checkbox.
     */
    handleAnswerSelection(event) {
        // The 'event.target' is the specific <input> element the user clicked.
        const inputElement = event.target;
        
        // We can get the question number from the 'data-question' attribute on the input.
        const questionNumber = parseInt(inputElement.dataset.question, 10);
        const questionData = this.questions.find(q => q.number === questionNumber);

        // Safety check to ensure we found the corresponding question data.
        if (!questionData) {
            console.error(`handleAnswerSelection: Could not find data for question #${questionNumber}`);
            return;
        }

        // We need to find the parent <fieldset> to correctly get all selected
        // values, which is especially important for multi-select (checkbox) questions.
        const answerFieldset = document.getElementById(`answers-${questionNumber}`);
        const inputType = answerFieldset.getAttribute('data-input-type');

        let selectedLetters = [];
        if (inputType === 'radio') {
            // For radio buttons, the selection is simple: it's just the value of the clicked input.
            selectedLetters.push(inputElement.value);
        } else { // 'checkbox'
            // For checkboxes, we need to find all inputs within the fieldset that are currently checked.
            const checkedCheckboxes = answerFieldset.querySelectorAll('input[type="checkbox"]:checked');
            // We then create an array of their values (e.g., ['A', 'C']).
            selectedLetters = Array.from(checkedCheckboxes).map(cb => cb.value);
        }

        // Here is the core of this function: we update the 'userSelected' property on our
        // question object with the new selection. This is our state-saving mechanism.
        questionData.userSelected = selectedLetters;
        console.log(`Answer for question #${questionNumber} saved. New selection: [${selectedLetters.join(', ')}]`);

        // After saving the answer, we call our new method to ensure the progress bar accurately reflects the new state.
        this._updateProgress();
    }

    /**
     * Handles clicks on the "Explain (✨)" icon for a question.
     * @param {Event} event - The click event generated by the user's click on the icon.
     */
    async handleExplainClick(event) {
        event.preventDefault();

        const icon = event.target;
        const questionNumber = parseInt(icon.getAttribute('data-question-number'), 10);
        const responseArea = document.getElementById(`llm-response-${questionNumber}`);

        // Prevent action if the icon is already processing a request.
        if (icon.classList.contains('disabled')) {
            return;
        }
        // Add the 'disabled' class to provide visual feedback and prevent multiple clicks.
        icon.classList.add('disabled');
        
        // Show a loading message in the response area.
        if (responseArea) {
            responseArea.innerHTML = '<em>Requesting explanation from LLM...</em>';
            responseArea.style.display = 'block';
        } else {
            console.error(`handleExplainClick: Response area for question ${questionNumber} not found!`);
            icon.classList.remove('disabled'); // Re-enable icon on error
            return;
        }

        // Get LLM configuration and question data.
        const llmConfig = this._getCurrentLlmConfig();

        const questionData = this.questions.find(q => q.number === questionNumber);
        if (!questionData) {
            if (responseArea) responseArea.textContent = 'Error: Could not find question data.';
            icon.classList.remove('disabled'); // Re-enable icon on error
            return;
        }

        let rawExplanationMarkdown = ''; 
        try {
            // Fetch the explanation from the LLM.
            rawExplanationMarkdown = await this.getLlmExplanation(questionData.text, questionData.answers, llmConfig);
    
            // Display the explanation, parsing it from Markdown to HTML.
            if (responseArea) {
                responseArea.innerHTML = typeof marked !== 'undefined' ? marked.parse(rawExplanationMarkdown) : rawExplanationMarkdown;
            }
    
            // --- "Continue Discussion" Button Logic ---
            // This now correctly happens only on a successful response.
            const questionContainer = document.getElementById(`container-${questionNumber}`);
            if (questionContainer) {
                // First, remove any old "Continue Discussion" button to prevent duplicates.
                const existingContinueBtn = questionContainer.querySelector('.continue-discussion-btn');
                if (existingContinueBtn) existingContinueBtn.remove();
    
                // Create the new button.
                const continueButton = document.createElement('button');
                continueButton.classList.add('continue-discussion-btn');
                continueButton.textContent = 'Continue Discussion';
                
                // Place it right after the LLM response area.
                if (responseArea) {
                    responseArea.insertAdjacentElement('afterend', continueButton);
                } 
                
                // Add the click listener to start the chat interface.
                continueButton.addEventListener('click', () => {
                    this.initiateChatInterface(questionNumber, rawExplanationMarkdown);
                });
            }

        } catch (error) {
            // Handle any errors during the API call.
            console.error(`handleExplainClick: An error occurred while fetching explanation:`, error);
            if (responseArea) {
                responseArea.innerHTML = `<p style="color:var(--error-color);">Sorry, an error occurred.</p>`;
            }
        } finally {
            // This 'finally' block runs regardless of whether the try succeeded or failed.
            // It's the perfect place to re-enable the icon.
            icon.classList.remove('disabled');
            console.log(`handleExplainClick: LLM interaction complete for question ${questionNumber}. Icon re-enabled.`);
        }
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
        const llmConfig = this._getCurrentLlmConfig();

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
     * Renders the final review screen by calling the UI function and attaching all necessary listeners.
     * @private
     */
    _displayReviewScreen() {
        // Get the HTML for the review screen from our ui.js function.
        const reviewHtml = displayReviewScreen(this.questions);
        
        const quizContentElement = document.getElementById('quiz-content');
        if (quizContentElement) {
            // Inject the HTML into the page.
            quizContentElement.innerHTML = reviewHtml;
            console.log("Review Screen has been displayed.");

            // --- Attach Listener for the Grade Exam Button ---
            const gradeButton = document.getElementById('grade-exam-btn');
            if (gradeButton) {
                // Attach the existing gradeExam method as its click handler.
                gradeButton.addEventListener('click', this.gradeExam.bind(this));
            }

            // --- Attach Listener for the Question List Items ---
            const questionList = quizContentElement.querySelector('.review-question-list');
            if (questionList) {
                // Attach the handler for jumping to a specific question.
                questionList.addEventListener('click', this.handleReviewItemClick.bind(this));
            }

            // Find the container for the filter buttons that we just rendered.
            const filtersContainer = quizContentElement.querySelector('.review-filters');
            if (filtersContainer) {
                // Add a single click listener to the entire container. This uses event
                // delegation, which is efficient. When a click occurs inside this
                // container, it will call our handleFilterClick method.
                filtersContainer.addEventListener('click', this.handleFilterClick.bind(this));
                console.log("Event listener for filter buttons has been attached.");
            }
        }
    }

    /**
     * Calculates the final score in Exam Mode by iterating through all questions and their stored answers.
     * After scoring is complete, it calls handleQuizCompletion to show the results modal.
     */
    gradeExam() {
        console.log("gradeExam: Grading process initiated by user click.");
        
        // Initialize a variable to hold the final score.
        let finalScore = 0;

        // Loop through each question object in our main `this.questions` array.
        this.questions.forEach(question => {
            // For each question, retrieve the user's stored answer and the correct answer(s).
            const sortedSelected = [...question.userSelected].sort();
            const sortedCorrect = [...question.correct].sort();

            // Perform the same logic as study mode to check for correctness.
            // We sort both arrays to ensure a consistent comparison for multi-answer questions.
            const isCorrect = sortedSelected.length === sortedCorrect.length &&
                              sortedSelected.every((value, index) => value === sortedCorrect[index]);

            if (isCorrect) {
                // If the answer is correct, increment the score.
                finalScore++;
            } else {
                // If incorrect, we still mark it as such. This is important for our
                // "Review Flagged & Incorrect" feature on the final modal screen.
                question.wasAnsweredIncorrectly = true;
            }
        });

        // After the loop finishes, update the main `this.currentScore` property with the calculated score.
        this.currentScore = finalScore;
        console.log(`Exam grading complete. Final score: ${this.currentScore} / ${this.totalQuestions}`);
        
        // Now that the final score is known, we can call the original completion handler
        // to show the user the standard end-of-quiz results modal.
        this.handleQuizCompletion();

        // Finally, find the 'Grade Exam' button and disable it to prevent the user
        // from re-submitting and running the grading logic multiple times.
        const gradeButton = document.getElementById('grade-exam-btn');
        if (gradeButton) {
            gradeButton.disabled = true;
            gradeButton.textContent = 'Exam Graded';
        }
    }

    /**
     * Handles clicks on the 'Next' button in Exam Mode.
     * This method is now simplified. It advances the index for the current
     * navigation set (either the full quiz or a filtered review set). The logic
     * for changing the button's text is now handled in _attachExamNavListeners.
     */
    handleNextQuestionClick() {
        const isReviewing = this.reviewSet.length > 0;

        if (isReviewing) {
            // --- Filtered Navigation Logic ---
            // If we are reviewing a filtered set and there are more questions...
            if (this.reviewSetIndex < this.reviewSet.length - 1) {
                this.reviewSetIndex++;
                const nextQuestionInSet = this.reviewSet[this.reviewSetIndex];
                this.currentQuestionIndex = this.questions.findIndex(q => q.number === nextQuestionInSet.number);
                this._renderCurrentView();
            } else {
                // ...else we've finished the filtered set, so we return to the summary.
                this._displayReviewScreen();
            }
        } else {
            // --- Standard Navigation Logic ---
            // If we are in the main quiz and there are more questions...
            if (this.currentQuestionIndex < this.questions.length - 1) {
                this.currentQuestionIndex++;
                this._renderCurrentView();
            } else {
                // ...otherwise, we've finished the main quiz, so we go to the summary.
                this._displayReviewScreen();
            }
        }
    }

    /**
     * Handles clicks on the 'Previous' button in Exam Mode.
     * This method is now "context-aware". It checks if a filtered 'reviewSet'
     * is active and navigates backward through that set.
     */
    handlePreviousQuestionClick() {
        // First, determine if we are in the special filtered review sub-mode.
        const isReviewing = this.reviewSet.length > 0;

        if (isReviewing) {
            // --- Filtered Navigation Logic ---
            // If a reviewSet is active, our logic is based on the 'reviewSetIndex'.

            // Check if we are NOT on the first question of the filtered set.
            if (this.reviewSetIndex > 0) {
                // If we can go back, we decrement the reviewSetIndex.
                this.reviewSetIndex--;

                // Now, we get the previous question object from our filtered set.
                const prevQuestionInSet = this.reviewSet[this.reviewSetIndex];

                // As before, we find this question's original position in the main
                // 'this.questions' array to ensure the correct data is used for rendering.
                this.currentQuestionIndex = this.questions.findIndex(q => q.number === prevQuestionInSet.number);
                
                console.log(`ReviewSet Previous: Jumping to index ${this.reviewSetIndex} in the review set.`);
                this._renderCurrentView();
            }
        } else {
            // --- Standard Navigation Logic ---
            // If no reviewSet is active, the logic works as it did before.

            // Check if we are NOT on the first question of the full quiz.
            if (this.currentQuestionIndex > 0) {
                this.currentQuestionIndex--;
                console.log(`Standard Previous: New index: ${this.currentQuestionIndex}`);
                this._renderCurrentView();
            }
        }
    }

    /**
     * Finds navigation buttons and attaches handlers. It contains the centralized logic for controlling button state (enabled/disabled) and text ("Next" vs. "Summary"),
     * @private
     */
    _attachExamNavListeners() {
        const prevButton = document.getElementById('prev-return-btn');
        const nextButton = document.getElementById('next-question-btn');

        // --- Attach Event Listeners ---
        // These are now straightforward attachments. The complex logic is handled below.
        if (prevButton) {
            prevButton.addEventListener('click', this.handlePreviousQuestionClick.bind(this));
        }
        if (nextButton) {
            nextButton.addEventListener('click', this.handleNextQuestionClick.bind(this));
        }

        // This block is the single source of truth for how the navigation buttons should look and behave, regardless of being in the main quiz or a filtered review.
        const isReviewing = this.reviewSet.length > 0;
        const totalInSet = isReviewing ? this.reviewSet.length : this.questions.length;
        const currentIndexInSet = isReviewing ? this.reviewSetIndex : this.currentQuestionIndex;

        // --- Handle the "Previous" button state ---
        if (prevButton) {
            // The "Previous" button should ALWAYS be disabled if we are on the 
            // first question (index 0) of the current navigation set.
            prevButton.disabled = (currentIndexInSet === 0);
        }

        // --- Handle the "Next" button state and text ---
        if (nextButton) {
            if (currentIndexInSet === totalInSet - 1) {
                // If we are on the LAST question of the current set...
                if (isReviewing) {
                    // ...and we are reviewing a FILTERED set (e.g., "Flagged"),
                    // the button's text must be "Return to Summary".
                    nextButton.textContent = 'Return to Summary';
                } else {
                    // ...and we are at the end of the MAIN quiz, the button's
                    // text must be "Summary".
                    nextButton.textContent = 'Summary';
                }
            } else {
                // For all other questions in any set, the button is simply "Next".
                nextButton.textContent = 'Next';
            }
        }
    }

    /**
     * Handles a click on an item in the review question list.
     * It navigates the user back to the corresponding single-question view and
     * correctly sets the index for filtered navigation if a review set is active.
     * @param {Event} event - The click event from the review list.
     */
    handleReviewItemClick(event) {
        // Find the parent .review-question-item element that was clicked.
        const questionItem = event.target.closest('.review-question-item');

        if (questionItem) {
            // Retrieve the question's original index from its data attribute.
            const questionIndex = parseInt(questionItem.dataset.questionIndex, 10);
            
            if (!isNaN(questionIndex)) {
                // --- THIS IS THE CORE LOGIC OF THIS METHOD ---

                // 1. Always update the main currentQuestionIndex. This tells the application
                // which question data to load and display.
                this.currentQuestionIndex = questionIndex;

                // 2. Check if we are currently in a filtered review sub-mode.
                if (this.reviewSet.length > 0) {
                    // If we are, we need to sync our position within that filtered set.
                    
                    // Get the unique number of the question the user is jumping to.
                    const questionNumber = this.questions[questionIndex].number;
                    
                    // Find the position (index) of that specific question within our
                    // temporary 'reviewSet' array.
                    this.reviewSetIndex = this.reviewSet.findIndex(q => q.number === questionNumber);
                    
                    console.log(`Jumping to question. Main index: ${this.currentQuestionIndex}, ReviewSet index: ${this.reviewSetIndex}`);
                } else {
                    // If not in a filtered review, just log the main index.
                    console.log(`Jumping to question. Main index: ${this.currentQuestionIndex}`);
                }

                // 3. Finally, call our main render method to display the selected question.
                this._renderCurrentView();
            }
        }
    }

    /**
     * Handles clicks on the filter buttons ('All', 'Unanswered', 'Flagged') on the review screen.
     * It filters the main question list and re-renders the list view.
     * @param {Event} event - The click event from the filter buttons container.
     */
    handleFilterClick(event) {
        // .closest() finds the nearest parent element that is a .filter-btn.
        // This ensures the code works even if the user clicks an icon inside the button.
        const filterButton = event.target.closest('.filter-btn');
        if (!filterButton) return; // If the click was not on a button, do nothing.

        // Get the type of filter from the button's 'data-filter' attribute.
        const filterType = filterButton.dataset.filter;
        console.log(`Filter button clicked. Filtering by: '${filterType}'`);

        let filteredQuestions = [];

        // Use a switch statement to create a new array based on the filter type.
        switch (filterType) {
            case 'unanswered':
                // Filter for questions where the user has not made a selection.
                filteredQuestions = this.questions.filter(q => q.userSelected.length === 0);
                break;
            case 'flagged':
                // Filter for questions that the user has flagged for review.
                filteredQuestions = this.questions.filter(q => q.isFlaggedForReview);
                break;
            case 'all':
            default:
                // For 'all' or any other case, use the original, complete list of questions.
                filteredQuestions = this.questions;
                break;
        }

        if (filterType === 'all') {
            // If the user clicks 'All', we clear the reviewSet to signal that
            // we are exiting the special filtered navigation mode.
            this.reviewSet = [];
            console.log("Exiting filtered review mode. Navigation will now cycle through all questions.");
        } else {
            // If they click 'Unanswered' or 'Flagged', we create our review set.
            this.reviewSet = filteredQuestions;
            // We must also reset the index for this new set to the beginning.
            this.reviewSetIndex = 0;
            console.log(`Entering filtered review mode with ${this.reviewSet.length} questions.`);
        }

        // Find the container element for the question list in the DOM.
        const questionListContainer = document.querySelector('.review-question-list');
        if (questionListContainer) {
            // Use our UI helper function to generate the new HTML for the list.
            const newListHtml = generateReviewListHTML(filteredQuestions);
            // Replace the old list with the new, filtered list.
            questionListContainer.innerHTML = newListHtml;
        }

        // Used to update the visual "active" state of the filter buttons. by removing the 'active' class from all filter buttons.
        document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
        // Then, add the 'active' class to the specific button that was just clicked.
        filterButton.classList.add('active');
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

        // Ensure timeRemaining doesn't go below zero for display purposes
        const displayTime = Math.max(0, this.timeRemaining);

        // Calculate hours, minutes, and seconds from the total seconds
        const hours = Math.floor(displayTime / 3600);
        const minutes = Math.floor((displayTime % 3600) / 60);
        const seconds = displayTime % 60;

        // Format each part to always have two digits (e.g., 7 becomes '07')
        const formattedHours = String(hours).padStart(2, '0');
        const formattedMinutes = String(minutes).padStart(2, '0');
        const formattedSeconds = String(seconds).padStart(2, '0');

        // Update the element's text content with the final formatted time string
        timerElement.textContent = `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
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

        // --- Determine the provider from the model string for cleaner logic ---
        // This allows us to handle all 'ollama/' or 'gemini-' or 'gpt-' models with a single 'case' each, making the code much easier to read and maintain.
        let provider = 'unknown';
        if (llmConfig.model.startsWith('ollama/')) {
            provider = 'ollama';
        } else if (llmConfig.model.startsWith('gemini-')) {
            provider = 'gemini';
        } else if (llmConfig.model.startsWith('gpt-')) {
            provider = 'openai';
        } else if (llmConfig.model.startsWith('sonar')) { // Correctly identifies Perplexity models
            provider = 'perplexity';
        } else if (llmConfig.model === 'none') {
            provider = 'none';
        }

        // This switch statement routes the request to the correct API logic
        // based on the 'provider' we determined above.
        switch (provider) {
            case 'ollama': {
                // --- OLLAMA API LOGIC (Chat History) ---
                const ollamaEndpoint = 'http://localhost:11434/api/chat';
                const specificOllamaModelName = llmConfig.model.substring('ollama/'.length);
                console.log(`_fetchLlmChatHistoryResponse: Calling Ollama (Model: ${specificOllamaModelName}) via /api/chat.`);

                try {
                    const response = await fetch(ollamaEndpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            model: specificOllamaModelName,
                            messages: messagesArray, // Send the full conversation history
                            stream: false
                        }),
                    });
                    if (!response.ok) {
                        let errorBody = await response.text();
                        try { const errorJson = JSON.parse(errorBody); if (errorJson?.error) { errorBody = errorJson.error; } } catch (e) { /* ignore */ }
                        throw new Error(`Ollama API Error (${response.status}): ${errorBody}`);
                    }
                    const data = await response.json();
                    if (data.message?.content) {
                        textResponse = data.message.content.trim();
                    } else {
                        textResponse = 'Error: Empty or unexpected response from Ollama chat.';
                    }
                } catch (error) {
                    throw error;
                }
                break;
            }

            case 'gemini': {
                // --- GEMINI API LOGIC (Chat History) ---
                // This case now correctly handles ALL models starting with 'gemini-'.
                if (!llmConfig.apiKey) {
                    throw new Error("API Key required for Google Gemini model.");
                }
                const geminiModelName = llmConfig.model;
                const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModelName}:generateContent?key=${llmConfig.apiKey}`;
                console.log(`_fetchLlmChatHistoryResponse: Calling Gemini (Model: ${geminiModelName}) for chat history.`);

                // Prepare the message history for the Gemini API format.
                let systemInstruction = null;
                let historyForGeminiContents = messagesArray; 

                if (messagesArray[0]?.role === 'system') {
                    systemInstruction = { parts: [{ text: messagesArray[0].content }] };
                    historyForGeminiContents = messagesArray.slice(1); 
                }

                const geminiFormattedMessages = convertMessagesToGeminiFormat(historyForGeminiContents);
                const requestBody = { contents: geminiFormattedMessages };
                if (systemInstruction) {
                    requestBody.systemInstruction = systemInstruction;
                }

                // Send the request and handle the response.
                const response = await fetch(geminiEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody),
                });

                if (!response.ok) {
                    let errorMsg = `Gemini API request failed: ${response.status}`;
                    try {
                        const errorData = await response.json();
                        if (errorData?.error?.message) { errorMsg += `: ${errorData.error.message}`; }
                    } catch (e) { /* ignore */ }
                    throw new Error(errorMsg);
                }
                const data = await response.json();
                if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                    textResponse = data.candidates[0].content.parts[0].text.trim();
                } else {
                    let blockReasonDetail = "No specific block reason found.";
                    if (data.promptFeedback?.blockReason) {
                        blockReasonDetail = `Reason: ${data.promptFeedback.blockReason}.`;
                    }
                    throw new Error(`Gemini request blocked or yielded empty content for chat. ${blockReasonDetail}`);
                }
                break;
            }

                case 'openai': {
                    // --- OPENAI API LOGIC (Chat History) ---
                    if (!llmConfig.apiKey) {
                        throw new Error("API Key required for OpenAI model.");
                    }
                    const openAIEndpoint = 'https://api.openai.com/v1/chat/completions';

                    // The request payload for a chat history call must use the `messagesArray` variable, which contains the entire conversation history.
                    const requestPayload = {
                        model: llmConfig.model,
                        messages: messagesArray,
                    };

                    const response = await fetch(openAIEndpoint, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${llmConfig.apiKey}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(requestPayload)
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        const errorMsg = errorData?.error?.message || `OpenAI API request failed: ${response.status}`;
                        throw new Error(errorMsg);
                    }
                    
                    const data = await response.json();
                    if (data.choices?.[0]?.message?.content) {
                        textResponse = data.choices[0].message.content.trim();
                    } else {
                        throw new Error('Error: Unexpected response format from OpenAI.');
                    }
                    break;
                }

            case 'perplexity': {
                // This block handles Perplexity API calls for ongoing chats.
                if (!llmConfig.apiKey) throw new Error("API Key required for Perplexity model.");
                
                const perplexityEndpoint = 'https://api.perplexity.ai/chat/completions';
                const perplexityModelName = llmConfig.model; // Use the dynamically selected model
                console.log(`_fetchLlmChatHistoryResponse: Calling Perplexity (Model: ${perplexityModelName}).`);

                // The 'messagesArray' contains the entire conversation history, which we send directly.
                let messagesForApi = [...messagesArray];
                // Perplexity's API can sometimes have issues if the second message is from the 'assistant'.
                // This is a defensive check to prevent that potential issue.
                if (messagesForApi[0]?.role === 'system' && messagesForApi[1]?.role === 'assistant') {
                    messagesForApi.splice(1, 1);
                }

                const requestPayload = { model: perplexityModelName, messages: messagesForApi };
                
                // Make the asynchronous 'fetch' call.
                const response = await fetch(perplexityEndpoint, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${llmConfig.apiKey}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify(requestPayload)
                });

                // Check for errors and parse the response.
                if (!response.ok) {
                    const errorDetail = await response.text();
                    throw new Error(`Perplexity API request failed: ${response.status} - ${errorDetail}`);
                }
                const data = await response.json();
                if (data.choices?.[0]?.message?.content) {
                    textResponse = data.choices[0].message.content.trim();
                } else {
                    throw new Error('Error: Unexpected response format from Perplexity chat.');
                }
                break;
            }

            case 'none':
                // If no model is selected, return a user-friendly message.
                textResponse = "Please select an LLM model to continue the chat.";
                break;

            default:
                // This acts as a fallback for any unexpected model value.
                throw new Error(`Unsupported LLM model for chat history: ${llmConfig.model}`);
                }
                // Return the successfully fetched text response.
                return textResponse;
            }
    
    /**
     * Gets the current LLM configuration from the active UI provider settings.
     * This is the central point for retrieving the model and API key. It is "aware"
     * of the different UI components (radio buttons for some providers, select dropdowns for others).
     * @returns {object} An object containing the selected 'model' and 'apiKey'.
     * @private
     */
    _getCurrentLlmConfig() {
        // First, get the value of the main provider dropdown (e.g., 'google-gemini', 'perplexity').
        const provider = document.getElementById('apiProviderSelect').value;
        
        // Prepare a default configuration object. This will be returned if no provider is selected.
        const config = {
            model: 'none',
            apiKey: ''
        };

        // If the user hasn't selected a provider, exit immediately with the default config.
        if (provider === 'none') {
            return config;
        }

        // Find the specific settings container for the chosen provider (e.g., <div id="perplexity-settings">).
        const settingsPanel = document.getElementById(`${provider}-settings`);
        if (!settingsPanel) {
            // If, for some reason, the settings panel for the selected provider doesn't exist, log an error and return the default config.
            console.error(`_getCurrentLlmConfig: Could not find settings panel for provider: ${provider}`);
            return config;
        }

        // --- Read the API Key ---
        // Find the API key input field within the currently visible settings panel.
        const apiKeyInput = settingsPanel.querySelector('.api-key-input');
        if (apiKeyInput) {
            // If an API key input exists, store its value in our configuration object.
            config.apiKey = apiKeyInput.value;
        }

        // --- Read the Selected Model ---
        // First, try to find a checked radio button within the settings panel. This is for our new UI.
        const checkedRadio = settingsPanel.querySelector('input[type="radio"]:checked');
        if (checkedRadio) {
            // If a checked radio button is found, its 'value' (e.g., "sonar-pro", "gpt-4o") is our selected model.
            config.model = checkedRadio.value;
        } else {
            // If no radio button is found (e.g., for Ollama, which still uses a dropdown),
            // fall back to looking for a <select> element.
            const modelSelect = settingsPanel.querySelector('select');
            if (modelSelect) {
                // If a dropdown is found, its value is our selected model.
                config.model = modelSelect.value;
            }
        }
        
        // --- Final Adjustments ---
        // The backend logic for Ollama expects the model name to be prefixed with "ollama/".
        // We add that prefix here if the selected provider is Ollama.
        if (provider === 'ollama') {
            config.model = `ollama/${config.model}`;
        }

        // Log the final configuration for debugging purposes (but don't log the actual API key).
        console.log('_getCurrentLlmConfig: Final resolved config:', { ...config, apiKey: config.apiKey ? '[Key Entered]' : '[No Key]' });
        
        // Return the completed configuration object.
        return config;
    }
    
    /**
     * Private helper method to make API calls for a single prompt.
     * @param {object} llmConfig - Configuration for the LLM, containing the model and API key.
     * @param {string} promptString - The fully prepared prompt string to send to the API.
     * @returns {Promise<string>} A promise that resolves with the LLM's text response.
     * @throws {Error} If the API call fails or the response format is unexpected.
     * @private
     */
    async _fetchLlmSinglePromptResponse(llmConfig, promptString) {
        // This variable will hold the final text response from the API.
        let textResponse = '';
        // Log the attempt for debugging, showing which model is being used.
        console.log(`_fetchLlmSinglePromptResponse: Attempting response from provider/model: ${llmConfig.model}. Prompt snippet: "${promptString.substring(0, 100)}..."`);

        // --- Determine Provider ---
        // We determine which provider to use based on the prefix of the model name.
        // This makes the logic flexible and easy to extend.
        let provider = 'unknown';
        if (llmConfig.model.startsWith('ollama/')) {
            provider = 'ollama';
        } else if (llmConfig.model.startsWith('gemini-')) {
            provider = 'gemini';
        } else if (llmConfig.model.startsWith('gpt-')) {
            provider = 'openai';
        } else if (llmConfig.model.startsWith('sonar')) { // Correctly identifies all Perplexity models
            provider = 'perplexity';
        } else if (llmConfig.model === 'none') {
            provider = 'none';
        }

    // This switch statement routes the request to the correct API logic
    // based on the 'provider' we determined above.
    switch (provider) {
        case 'ollama': {
            // --- OLLAMA API LOGIC (Single Prompt) ---
            const ollamaEndpoint = 'http://localhost:11434/api/generate';
            const specificOllamaModelName = llmConfig.model.substring('ollama/'.length);
            console.log(`_fetchLlmSinglePromptResponse: Calling Ollama (Model: ${specificOllamaModelName}) via /api/generate.`);
            
            try {
                const response = await fetch(ollamaEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: specificOllamaModelName,
                        prompt: promptString,
                        stream: false 
                    }),
                });
                if (!response.ok) {
                    let errorBody = await response.text();
                    try { const errorJson = JSON.parse(errorBody); if (errorJson && errorJson.error) { errorBody = errorJson.error; } } catch (e) { /* ignore */ }
                    throw new Error(`Ollama API Error (${response.status}): ${errorBody}`);
                }
                const data = await response.json();
                if (data.response) {
                    textResponse = data.response.trim();
                } else {
                    textResponse = 'Error: Empty or unexpected response from Ollama generate.';
                }
            } catch (error) {
                 throw error; // Propagate the error to be handled by the calling function.
            }
            break;
        }

        case 'gemini': {
            // --- GEMINI API LOGIC (Single Prompt) ---
            // This case now correctly handles ALL models starting with 'gemini-'.
            if (!llmConfig.apiKey) {
                throw new Error("API Key required for Google Gemini model.");
            }
            // The specific model ID (e.g., 'gemini-2.5-flash') is used to build the endpoint URL.
            const geminiModelName = llmConfig.model; 
            const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModelName}:generateContent?key=${llmConfig.apiKey}`;
            console.log(`_fetchLlmSinglePromptResponse: Calling Gemini (Model: ${geminiModelName}).`);

            // Construct and send the request according to Gemini's API format.
            const requestBody = { contents: [{ parts: [{ text: promptString }] }] };
            const response = await fetch(geminiEndpoint, { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            // Handle the response, checking for errors.
            if (!response.ok) {
                let errorMsg = `Gemini API request failed: ${response.status}`;
                try {
                    const errorData = await response.json();
                    if (errorData?.error?.message) { errorMsg += `: ${errorData.error.message}`; }
                } catch (e) { /* ignore if error response isn't JSON */ }
                throw new Error(errorMsg);
            }
            const data = await response.json();
            if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                textResponse = data.candidates[0].content.parts[0].text.trim();
            } else {
                if (data.promptFeedback?.blockReason) {
                    throw new Error(`Gemini request blocked by safety settings (${data.promptFeedback.blockReason}).`);
                }
                throw new Error('Error: Unexpected response format from Gemini.');
            }
            break; 
        }

        case 'openai': {
            // --- OPENAI API LOGIC (Single Prompt) ---
            if (!llmConfig.apiKey) {
                throw new Error("API Key required for OpenAI model.");
            }
            const openAIEndpoint = 'https://api.openai.com/v1/chat/completions';
            
            // OpenAI's API requires the prompt to be inside a 'messages' array, even for a single turn.
            const messagesForSinglePrompt = [{ role: "user", content: promptString }];
            
            const requestPayload = {
                model: llmConfig.model, // Use the dynamically selected model ID (e.g., "gpt-4o")
                messages: messagesForSinglePrompt,
            };

            const response = await fetch(openAIEndpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${llmConfig.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestPayload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                const errorMsg = errorData?.error?.message || `OpenAI API request failed: ${response.status}`;
                throw new Error(errorMsg);
            }
            
            const data = await response.json();
            if (data.choices?.[0]?.message?.content) {
                textResponse = data.choices[0].message.content.trim();
            } else {
                throw new Error('Error: Unexpected response format from OpenAI.');
            }
            break;
        }

        case 'perplexity': {
            if (!llmConfig.apiKey) throw new Error("API Key required for Perplexity model.");
            
            const perplexityEndpoint = 'https://api.perplexity.ai/chat/completions';
            const perplexityModelName = llmConfig.model;
            console.log(`_fetchLlmSinglePromptResponse: Calling Perplexity (Model: ${perplexityModelName}).`);
            
            const messages = [{ "role": "user", "content": promptString }];
            const requestPayload = { model: perplexityModelName, messages: messages };

            const response = await fetch(perplexityEndpoint, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${llmConfig.apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(requestPayload)
            });

            if (!response.ok) {
                const errorDetail = await response.text();
                throw new Error(`Perplexity API request failed: ${response.status} - ${errorDetail}`);
            }
            const data = await response.json();
            
            if (data.choices?.[0]?.message?.content) {
                textResponse = data.choices[0].message.content.trim();
            } else {
                throw new Error('Error: Unexpected response format from Perplexity.');
            }
            break;
        }

        case 'none':
            // If no model is selected, return a user-friendly message.
            textResponse = "Please select an LLM model to get an explanation.";
            break;

        default:
            // This acts as a fallback for any unexpected model value.
            throw new Error(`Unsupported LLM model for single prompt: ${llmConfig.model}`);
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
        // Target the new, correct ID for the Ollama-specific dropdown
        const ollamaModelSelect = document.getElementById('ollamaModelSelect');
        if (!ollamaModelSelect) {
            // This error might appear temporarily before the user selects "Ollama" as a provider, which is okay.
            console.warn("populateOllamaModelsDropdown: Ollama model select element not found or not visible yet.");
            return;
        }

        // Clear any existing options before fetching new ones
        ollamaModelSelect.innerHTML = '';

        const ollamaModels = await this._fetchAvailableOllamaModels();

        if (ollamaModels.length === 0) {
            console.log("populateOllamaModelsDropdown: No Ollama models fetched or Ollama not available.");
            // Add a disabled option to inform the user
            const option = document.createElement('option');
            option.value = "none";
            option.textContent = "Ollama not found";
            option.disabled = true;
            ollamaModelSelect.appendChild(option);
            return;
        }

        // Add new options for each fetched Ollama model
        ollamaModels.forEach(modelName => {
            const option = document.createElement('option');
            // The value no longer needs the "ollama/" prefix, as we know the provider by context.
            option.value = modelName; 
            option.textContent = modelName; // Display the model name directly
            ollamaModelSelect.appendChild(option);
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

        const controlsShouldBeEnabled = !this.isTimeInfinite && this.totalQuestions > 0;

        // If the controls should NOT be enabled (e.g., no quiz loaded yet, or time is infinite)
        if (!controlsShouldBeEnabled) {
            startPauseResumeButton.disabled = true;
            resetButton.disabled = true;
            startPauseResumeButton.textContent = 'Start'; // Set default text
            console.log("_updateTimerControlEventsUI: Timer controls disabled (infinite time or no quiz).");
            return; // Exit the function early
        }

        // If controls are generally allowed, proceed with more specific logic:
        resetButton.disabled = false; // The Reset button is always available in a valid quiz session.

        // Logic for the Start/Pause/Resume button
        if (this.isTimerRunning) {
            // If the timer is running...
            if (this.isTimerPaused) {
                // ...and it's currently paused, the button should say "Resume".
                startPauseResumeButton.textContent = 'Resume';
                startPauseResumeButton.disabled = false;
            } else {
                // ...and it's actively counting down, the button should say "Pause".
                startPauseResumeButton.textContent = 'Pause';
                startPauseResumeButton.disabled = false;
            }
        } else {
            // If the timer is NOT running (it's been reset or hasn't started yet)...
            // ...the button should say "Start".
            startPauseResumeButton.textContent = 'Start';
            // The Start button should only be clickable if there is time on the clock.
            startPauseResumeButton.disabled = !(this.initialTimerDuration > 0 || this.timeRemaining > 0) ;
        }
        console.log(`_updateTimerControlEventsUI: Start/Pause/Resume button text: "${startPauseResumeButton.textContent}", disabled: ${startPauseResumeButton.disabled}. Reset button disabled: ${resetButton.disabled}`);
    }
    
    /**
     * Handles clicks on the Start/Pause/Resume timer button.
     * This method determines the current state of the timer and calls the
     * appropriate internal method (_startCountdown, _pauseCountdown, or _resumeCountdown).
     * @param {Event} event - The click event passed by the browser's event listener.
     */
    handleTimerStartPauseResumeClick(event) {
        console.log("handleTimerStartPauseResumeClick: Button clicked.");

        // The check for isTimerEnabled has been removed. The function now proceeds
        // directly to the relevant logic for the timer controls.

        // This check is still valid and important. The controls are not applicable
        // if the user has set the timer to have no time limit.
        if (this.isTimeInfinite) {
            console.warn("handleTimerStartPauseResumeClick: Timer is set to 'No Time Limit'. Start/Pause/Resume controls are not applicable.");
            alert("Timer controls (Start/Pause/Resume) are not available when 'No Time Limit' is set.");
            this._updateTimerControlEventsUI(); // Ensure button states are correct
            return;
        }

        // This logic correctly decides whether to start, pause, or resume the timer.
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
    }

    /**
     * Handles clicks on the Reset timer button.
     * This method calls the internal _resetCountdown method to reset the timer
     * to its initially configured duration.
     * @param {Event} event - The click event (not directly used).
     */
    handleTimerResetClick(event) {
        console.log("handleTimerResetClick: Button clicked.");

        // The 'if (!this.isTimerEnabled)' block has been removed here to make
        // the logic consistent with the removal of the ON/OFF feature.

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
        if (this.isTimerRunning && !this.isTimerPaused) {
            console.warn("_startCountdown: Timer is already running and not paused.");
            this._updateTimerControlEventsUI(); // Ensure UI is consistent
            return;
        }

        // If this is a fresh start (timer wasn't running), re-configure from input.
        if (!this.isTimerRunning) {
            console.log("_startCountdown: This is a fresh start. Re-configuring timer from input.");
            this._configureTimerFromInput();
        }

        // If timer is set to "No Time Limit" after configuration, don't start countdown.
        if (this.isTimeInfinite) {
            console.log("_startCountdown: Timer is configured to 'No Time Limit'. No countdown will start.");
            this.updateTimerDisplay();
            this._updateTimerControlEventsUI();
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
        this.isTimerRunning = true;
        this.isTimerPaused = false;
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

    /**
     * Calculates the number of answered questions based on the current mode and updates the progress bar UI.
     * This state-driven approach ensures the progress bar is always accurate.
     * @private
     */
    _updateProgress() {
        let answeredCount = 0;
        // The way we count "answered" questions is different for each mode.
        if (this.examMode === 'exam') {
            // In Exam Mode, a question is considered answered if the user has made a selection.
            // We filter the questions array to get only those where the userSelected array is not empty.
            const answeredQuestions = this.questions.filter(q => q.userSelected.length > 0);
            answeredCount = answeredQuestions.length;
        } else {
            // In Study Mode, a question is only "answered" after the user clicks "Submit".
            // We can therefore rely on our simple 'answeredQuestions' counter.
            answeredCount = this.answeredQuestions;
        }

        // Log the calculation for debugging purposes.
        console.log(`_updateProgress: Mode: '${this.examMode}'. Answered count: ${answeredCount}/${this.totalQuestions}`);

        // Call the original UI function from ui.js to update the visual progress bar.
        updateProgressBar(answeredCount, this.totalQuestions);
    }

}

/**
 * This event listener waits for the entire HTML document to be fully loaded and parsed before it runs the code inside. This guarantees that all HTML elements, including. This fixes the unresponsiveness of our "Review" buttons at the end of our quiz
 */
document.addEventListener('DOMContentLoaded', () => {
    new ExamManager();
    console.log("DOM fully loaded and parsed. ExamManager created.");
});
