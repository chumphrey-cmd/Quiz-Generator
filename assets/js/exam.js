class ExamManager {

    // --- 1. CONSTRUCTOR ---
    // Initializes properties and binds event handlers.

    /**
     * Initialize exam manager with default state
     */
    constructor() {
        // Quiz state variables are internal to the manager
        this.totalQuestions = 0;
        this.answeredQuestions = 0;
        this.currentScore = 0;
        this.questions = [];
        this.timerInterval = null;
        this.timeRemaining = 0;
        const initialTimerInput = document.getElementById('timerDurationInput');
        this.timerDuration = (initialTimerInput ? parseInt(initialTimerInput.value, 10) : 10) * 60;

        this.isTimerEnabled = true; // Timer is ON by default

        // Bound event handlers to maintain 'this' context
        this.handleFileUploadBound = this.handleFileUpload.bind(this);
        this.handleSubmitClickBound = this.handleSubmitClick.bind(this);
        this.handleExplainClickBound = this.handleExplainClick.bind(this);
        this.handleTimerToggleClickBound = this.handleTimerToggleClick.bind(this);
        
        this.handleSendChatMessageBound = this.handleSendChatMessage.bind(this); // Bound event handler for chat send button


        this.initializeEventListeners(); // Initial listeners (file, timer)
    }

    // --- 2. INITIALIZATION --- 
    // Methods related to setting up initial state or dynamic event listeners.

    /**
     * Set up initial event listeners (file upload, timer input validation).
     * Submit/Explain listeners are added *after* questions are rendered.
     */
    initializeEventListeners() {
        const fileInput = document.getElementById('questionFile');
        if (fileInput) {
            fileInput.addEventListener('change', this.handleFileUploadBound);
        } else { console.error("File input element 'questionFile' not found!"); }

        const timerInput = document.getElementById('timerDurationInput');
        if (timerInput) {
            // Input event listener for numeric only
            timerInput.addEventListener('input', function() {
                this.value = this.value.replace(/[^0-9]/g, '');
                 if (this.value.length > 1 && this.value.startsWith('0')) this.value = this.value.substring(1);
                 if (this.value === '') this.value = '1';
            });
             // Blur event listener for min/max enforcement
              timerInput.addEventListener('blur', function() {
                   const min = parseInt(this.min, 10) || 1;
                   const max = parseInt(this.max, 10) || 180;
                   let currentValue = parseInt(this.value, 10);
                   if (isNaN(currentValue) || currentValue < min) this.value = min;
                   else if (currentValue > max) this.value = max;
              });
        } else { console.error("Timer duration input element not found!"); }

        const timerToggleButton = document.getElementById('timerToggleButton');
        if (timerToggleButton) {
            timerToggleButton.addEventListener('click', this.handleTimerToggleClickBound);

            // Optional: Update button appearance on initial load based on state
            this.updateTimerToggleButtonVisuals(timerToggleButton);
        } else { console.error("Timer toggle button 'timerToggleButton' not found!");}
    }

    /**
     * Initialize listeners for all SUBMIT buttons after rendering questions.
     */
    initializeSubmitListeners() {
        document.querySelectorAll('.submit-btn').forEach(button => {
             // Remove potential old listener first to prevent duplicates on reload
             button.removeEventListener('click', this.handleSubmitClickBound);
             // Add the listener using the bound handler
            button.addEventListener('click', this.handleSubmitClickBound);
        });
        console.log("Submit button listeners initialized/refreshed.");
    }

    /**
     * Adds click event listeners to all "Explain" buttons.
     */
    initializeExplainListeners() {
        const explainButtons = document.querySelectorAll('.explain-btn');
        console.log(`Found ${explainButtons.length} explain buttons.`);
        explainButtons.forEach(button => {
             button.removeEventListener('click', this.handleExplainClickBound); // Remove old before adding
             button.addEventListener('click', this.handleExplainClickBound);
        });
        console.log("Explain button listeners initialized/refreshed.");
    }

    // --- 3. PRIMARY EVENT HANDLERS (Direct User Interactions) ---
    // Methods that are directly called when the user interacts with main UI elements.

    async handleFileUpload(event) {
        const files = event.target.files;
        if (!files || files.length === 0) {
            console.log("handleFileUpload: No files selected."); // Added Log
            return;
        }
        console.log(`handleFileUpload: Processing ${files.length} file(s)...`); // Added Log
    
        // File reading logic
        let allParsedQuestions = [];
        let fileReadPromises = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.name.endsWith('.txt') && file.type === 'text/plain') {
                 // console.log(`handleFileUpload: Reading file: ${file.name}`); // Optional log
                 fileReadPromises.push(this.readFileContent(file).catch(e => ({ error: e, fileName: file.name })));
            } else {
                 console.warn(`handleFileUpload: Skipping non-TXT file: ${file.name}`);
            }
        }
    
        try {
            // Wait for all files to be read
            const fileContents = await Promise.all(fileReadPromises);
            let combinedRawText = "";
            fileContents.forEach((content, index) => {
                 if (content.error) {
                      console.error(`handleFileUpload: Error reading file ${content.fileName}:`, content.error); // Added Log
                      alert(`Could not read file: ${content.fileName}. Skipping.`);
                      // Don't append content if there was an error reading it
                 } else {
                    // Append content only if read successfully
                    combinedRawText += content + "\n\n"; // Ensure separation between files
                 }
            });
            console.log("handleFileUpload: Combined raw text length:", combinedRawText.length); // Added Log
            // Trim trailing newlines from combining files before processing
            combinedRawText = combinedRawText.trim();
    
            // Inner try-catch specifically for parsing/validation phase
            try {
                // Call the parser function from parser.js
                console.log("handleFileUpload: Calling processQuestions..."); // Added Log
                const parsedFromCombined = processQuestions(combinedRawText); // Assumes processQuestions handles trimming if needed
                // *** ADDED LOG ***: Check the direct return value
                console.log("handleFileUpload: processQuestions returned:", parsedFromCombined);
    
                // Check if the result is truthy (an array, even empty, is truthy; null/undefined is falsy)
                if (parsedFromCombined !== null && typeof parsedFromCombined !== 'undefined') {
                     // *** ADDED LOG ***: Confirm assignment path
                     console.log("handleFileUpload: Assigning parsed questions to allParsedQuestions.");
                    allParsedQuestions = parsedFromCombined; // Assign the array (potentially empty)
                } else {
                     // *** ADDED LOG ***: Log if parser explicitly returned null/falsy (likely validation error)
                     console.log("handleFileUpload: processQuestions returned null or undefined value. Resetting.");
                     // Error message/alert likely happened inside processQuestions
                     resetDisplays(0);
                     return; // Exit if parsing/validation failed explicitly
                }
            } catch (error) {
                // Catch errors specifically occurring *during* the processQuestions call
                console.error('handleFileUpload: Error during processQuestions call:', error); // Added Log
                alert('An error occurred while parsing the questions.');
                resetDisplays(0);
                return;
            }
    
            // *** ADDED LOG *** Check the array variable *after* the assignment logic
            console.log("handleFileUpload: Value of allParsedQuestions before length check:", allParsedQuestions);
    
            // --- Check if questions were actually parsed ---
            // Ensure allParsedQuestions is an array before checking length
            if (!Array.isArray(allParsedQuestions)) {
                console.error("handleFileUpload: Error - allParsedQuestions is not an array! Value:", allParsedQuestions);
                alert("An internal error occurred after parsing. Check console.");
                resetDisplays(0);
                return;
            }
    
            // Now safely check the length
            if (allParsedQuestions.length === 0) {
                 // *** ADDED LOG ***
                 console.log("handleFileUpload: allParsedQuestions array is empty. Alerting user.");
                alert("No valid questions were successfully parsed from the selected file(s). Check file format and console logs (including parser logs).");
                resetDisplays(0);
                return; // Stop if no questions were parsed
            }
    
            // --- If we have questions, proceed ---
            console.log(`handleFileUpload: Total valid questions parsed: ${allParsedQuestions.length}`); // Existing log
    
            // Shuffle and renumber (unchanged)
            this.questions = this.shuffleArray(allParsedQuestions);
            this.renumberQuestions();
    
            // Reset state and UI (unchanged)
            this.totalQuestions = this.questions.length;
            this.answeredQuestions = 0;
            this.currentScore = 0;
            this.resetTimer();
            resetDisplays(this.totalQuestions);
    
            // Render questions using ui.js function
            console.log("handleFileUpload: Calling displayQuestions..."); // Added Log
            const htmlContent = displayQuestions(this.questions); // From ui.js
            console.log("handleFileUpload: HTML content generated length:", htmlContent.length); // Added Log
            // Ensure quiz-content element exists before setting innerHTML
            const quizContentElement = document.getElementById('quiz-content');
            if (quizContentElement) {
                quizContentElement.innerHTML = htmlContent;
                console.log("handleFileUpload: Injected HTML into quiz-content."); // Added Log
            } else {
                console.error("handleFileUpload: Could not find quiz-content element to inject HTML!");
                alert("Error: Could not display questions. UI element missing.");
                return;
            }
    
            // Initialize listeners for the newly added buttons
            console.log("handleFileUpload: Initializing Submit listeners..."); // Added Log
            this.initializeSubmitListeners();
            console.log("handleFileUpload: Initializing Explain listeners..."); // Added Log
            this.initializeExplainListeners();
    
            console.log('handleFileUpload: Quiz initialized successfully.'); // Added Log
            this.startTimer();
    
        } catch (error) {
             // Catch errors from await Promise.all or other general issues in the outer try
             console.error('handleFileUpload: General error in outer try block:', error); // Added Log
            alert('An unexpected error occurred while processing the files.');
            resetDisplays(0);
        }
         // Clear file input value regardless of success/failure
         if(event && event.target) {
            event.target.value = null;
         }
    }

    /**
     * Handles clicks on the timer toggle button
     */
    handleTimerToggleClick() {
        this.isTimerEnabled = !this.isTimerEnabled; // Flip the state
        console.log("Timer enabled state:", this.isTimerEnabled);

        const timerToggleButton = document.getElementById('timerToggleButton');
        if (timerToggleButton) {
           this.updateTimerToggleButtonVisuals(timerToggleButton);
        }

        // If timer is currently running AND we just disabled it, stop it.
        if (!this.isTimerEnabled && this.timerInterval) {
            this.stopTimer();
             // Optionally update display immediately
             this.updateTimerDisplay();
        }
        // Note: We don't automatically start the timer here if enabled.
        // It will start naturally on the next quiz load via handleFileUpload -> startTimer.
    }

    /**
     * Handles submit button clicks for a question.
     * Now determines input type (radio/checkbox) and processes accordingly.
     * @param {Event} event - Click event from the submit button.
     */
    handleSubmitClick(event) {
        const submitButton = event.currentTarget;
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
        }
        // Call UI update functions
        updateScoreDisplay(this.currentScore, this.answeredQuestions, this.totalQuestions);
        updateProgressBar(this.answeredQuestions, this.totalQuestions);

        // Check for quiz completion (Unchanged)
        if (this.answeredQuestions === this.totalQuestions) {
            this.handleQuizCompletion();
        }
    }

    /**
     * Handles clicks on the "Explain" button for a question.
     * Retrieves config, question, and answers, calls LLM, and displays response.
     * @param {Event} event - The click event.
     */
    async handleExplainClick(event) {
        event.preventDefault(); // Prevent any default button action
        const button = event.currentTarget;
        const questionNumber = parseInt(button.getAttribute('data-question-number'), 10);
        const responseArea = document.getElementById(`llm-response-${questionNumber}`);

        // Prevent multiple requests while one is processing
        if (button.disabled) return;
        button.disabled = true;
        button.textContent = 'Thinking...'; // Indicate loading

        // Ensure response area exists and show loading message
        if (responseArea) {
            responseArea.textContent = 'Requesting explanation from LLM...';
            responseArea.style.display = 'block'; // Show the area
        } else {
            console.error(`Response area llm-response-${questionNumber} not found!`);
            button.disabled = false; // Re-enable button if response area missing
            button.textContent = 'Explain';
            return;
        }

        console.log(`Explain button clicked for question number: ${questionNumber}`);

        // --- Read LLM Configuration from UI ---
        const apiKeyInput = document.getElementById('llmApiKeyInput');
        const modelSelect = document.getElementById('llmModelSelect');
        const apiKey = apiKeyInput ? apiKeyInput.value : ''; // Get API key value
        const selectedModel = modelSelect ? modelSelect.value : 'none'; // Get selected model value

        // --- Find the Question Text AND Answers ---
        // Ensure this.questions is populated and question numbers align
        const questionData = this.questions.find(q => q.number === questionNumber);
        if (!questionData) {
            console.error(`Could not find question data for number ${questionNumber}`);
            if (responseArea) responseArea.textContent = 'Error: Could not find question data.';
            button.disabled = false; // Re-enable button
            button.textContent = 'Explain';
            return;
        }
        const questionText = questionData.text;
        const questionAnswers = questionData.answers; // Get the answers array

        console.log("--- LLM Config Read ---");
        console.log("Selected Model:", selectedModel);
        console.log("API Key Entered:", apiKey ? "[Key Entered]" : "[No Key Entered]"); // Avoid logging key directly
        // console.log("Question Text:", questionText); // Optional: Keep for debugging if needed
        // console.log("Question Answers:", questionAnswers.map(a => `${a.letter}. ${a.text}`).join(', ')); // Optional

        // --- Call LLM and Display Response ---
        const llmConfig = {
            model: selectedModel,
            apiKey: apiKey
        };

        // Call the async explanation function and wait for the result
        const explanation = await this.getLlmExplanation(questionText, questionAnswers, llmConfig);

        // initialExplanationHtml is declared here, in the scope of handleExplainClick
        let initialExplanationHtml = ''; 

        if (responseArea) {
            if (typeof marked !== 'undefined') {
                // And assigned here
                initialExplanationHtml = marked.parse(explanation);
                responseArea.innerHTML = initialExplanationHtml;
                console.log("Parsed LLM response markdown and set as innerHTML.");
            } else {
                // Or assigned here
                initialExplanationHtml = explanation; 
                responseArea.textContent = initialExplanationHtml;
                console.warn("Marked.js library not found. Displaying LLM response as plain text.");
            }
            responseArea.style.display = 'block';


        // New code for "Continue Discussion" button
        // Remove any existing "Continue Discussion" button first to prevent duplicates
        const questionContainer = document.getElementById(`container-${questionNumber}`);
        if (questionContainer) {
            const existingContinueBtn = questionContainer.querySelector('.continue-discussion-btn');
            if (existingContinueBtn) {
                existingContinueBtn.remove();
            }
        }

        const continueButton = document.createElement('button');
        continueButton.classList.add('continue-discussion-btn');
        continueButton.textContent = 'Continue Discussion';
        // We don't need to store questionNumber in dataset if using event directly,
        // but it can be useful for debugging or if the handler is more generic.
        // The initialExplanationHtml is crucial.

        // Insert after the responseArea
        responseArea.insertAdjacentElement('afterend', continueButton);

        // Add event listener using an arrow function to maintain 'this' context
        // and pass necessary parameters.
        continueButton.addEventListener('click', () => {
            this.initiateChatInterface(questionNumber, initialExplanationHtml);
        });

        // Re-enable the button and reset text
        button.disabled = false;
        button.textContent = 'Explain';
        console.log("LLM interaction complete.");
        }

    }

    /**
     * Handles sending a user's chat message to the LLM and displaying the response.
     * This method now constructs the specific prompt for a chat follow-up
     * Uses the _fetchLlmResponse helper for the actual API call.
     * @param {Event} event - The click event from the "Send" button in the chat interface.
     */
    async handleSendChatMessage(event) {
        const button = event.currentTarget; // The "Send" button that was clicked
        const questionNumber = parseInt(button.dataset.questionNumber); // Get question number from button's data attribute
        const chatInput = document.getElementById(`chat-input-${questionNumber}`); // Get the chat input field
        
        // Retrieve the currently selected LLM model and API key from the UI
        const llmConfig = {
            model: document.getElementById('llmModelSelect').value,
            apiKey: document.getElementById('llmApiKeyInput').value
        };

        // If chat input is missing or the message is empty, do nothing
        if (!chatInput || !chatInput.value.trim()) {
            return; 
        }

        // Get the user's typed message
        const userMessage = chatInput.value.trim();

        // --- UI Update: Display user's message and prepare for LLM response ---
        this.displayChatMessage(userMessage, 'user', questionNumber); // Display user's message in chat
        chatInput.value = ''; // Clear the input field
        chatInput.disabled = true; // Disable input while waiting
        button.disabled = true; // Disable send button while waiting
        button.textContent = 'Sending...'; // Update button text

        try {
            // --- Context Gathering for Chat Prompt ---
            const questionData = this.questions.find(q => q.number === questionNumber);
            if (!questionData) {
                // This error will be caught by the catch block below
                throw new Error("Original question context not found for chat.");
            }

            // Retrieve the initial LLM explanation (first LLM message in this chat) to provide context
            const chatMessagesContainer = document.getElementById(`chat-messages-${questionNumber}`);
            const firstLlmMessageElement = chatMessagesContainer.querySelector('.chat-message-llm');
            const initialExplanationContext = firstLlmMessageElement ? firstLlmMessageElement.innerHTML : "Context: Initial explanation not available.";

            // --- Chat Prompt Construction ---

            const chatPrompt = `
            Context of our discussion:
            Original Question: "${questionData.text}"
            Answer Options:
            ${questionData.answers.map(ans => `${ans.letter}. ${ans.text}`).join('\n')}

            My previous explanation (which you, the LLM, provided):
            ---
            ${initialExplanationContext}
            ---

            The user now has a follow-up question or comment regarding this.
            User's follow-up: "${userMessage}"

            Please provide a concise and relevant response to the user's follow-up, keeping the original question and previous explanation in mind.
            If the user's follow-up seems unrelated, gently guide them back or ask for clarification.
            Adopt the same persona as the initial explanation (Expert Tutor and Subject Matter Expert).
            Focus on clarity and directness.
            Do not repeat the entire original question or previous explanation unless absolutely necessary for context in your new response.
            Directly address the user's follow-up: "${userMessage}"
            `;

            // --- Call Centralized LLM Fetch Logic ---
            // Delegate the actual API call to the _fetchLlmResponse helper method.
            // 'llmConfig' contains the provider and API key.
            // 'chatPrompt' is the fully constructed prompt for this chat turn.
            console.log("Calling _fetchLlmResponse for chat message...");
            const llmChatResponse = await this._fetchLlmResponse(llmConfig, chatPrompt);
            
            // --- Display LLM's Chat Response ---
            // Display the LLM's response in the chat interface.
            // Pass 'false' for isHtml, so if the LLM returns Markdown, it gets parsed by marked.js.
            this.displayChatMessage(llmChatResponse, 'llm', questionNumber, false);

        } catch (error) {
            // --- Error Handling ---
            // If any error occurred during context gathering or the _fetchLlmResponse call.
            console.error("Error during handling send chat message:", error);
            // Display a user-friendly error message in the chat interface.
            this.displayChatMessage(`Sorry, I encountered an error processing your message: ${error.message}`, 'llm', questionNumber, false);
        } finally {
            // --- UI Finalization ---
            // This block executes whether the try block succeeded or failed.
            // Re-enable the chat input field if it exists.
            if (chatInput) chatInput.disabled = false;
            // Re-enable the send button if it exists and reset its text.
            if (button) {
                button.disabled = false;
                button.textContent = 'Send';
            }
        }
    }

    // --- 4. CHAT INTERFACE MANAGEMENT ---
    // Methods specifically for controlling and updating the chat UI.

    /**
    * Method to initiate the chat interface
    **/
    initiateChatInterface(questionNumber, initialExplanationHtml) {
        console.log(`Initiating chat for question ${questionNumber}.`);

        const llmResponseArea = document.getElementById(`llm-response-${questionNumber}`);
        const chatInterfaceContainer = document.getElementById(`llm-chat-interface-container-${questionNumber}`);
        const chatMessagesContainer = document.getElementById(`chat-messages-${questionNumber}`);
        const sendChatButton = document.getElementById(`send-chat-btn-${questionNumber}`);
        const chatInput = document.getElementById(`chat-input-${questionNumber}`);

        // Find and hide/remove the "Continue Discussion" button
        // It should be a sibling of llmResponseArea or chatInterfaceContainer
        if (llmResponseArea && llmResponseArea.parentElement) {
            const continueButton = llmResponseArea.parentElement.querySelector('.continue-discussion-btn');
            if (continueButton) {
                continueButton.style.display = 'none'; // Or continueButton.remove();
            }
        }


        // Optionally hide the initial single explanation div
        if (llmResponseArea) {
            llmResponseArea.style.display = 'none';
        }

        // Make the main chat interface container visible
        if (chatInterfaceContainer) {
            chatInterfaceContainer.style.display = 'flex'; // Use 'flex' if CSS is designed for it, otherwise 'block'
        }

        // Clear any previous messages from the chat messages area
        if (chatMessagesContainer) {
            chatMessagesContainer.innerHTML = '';
        }

        // Display the initial explanation as the first chat message
        // Pass 'true' for isHtml because initialExplanationHtml is already parsed HTML.
        this.displayChatMessage(initialExplanationHtml, 'llm', questionNumber, true);

        // Add event listener for the actual send button inside this chat interface
        if (sendChatButton) {
            // Remove existing listener to prevent duplicates if this function could somehow be called multiple times for the same button
            sendChatButton.removeEventListener('click', this.handleSendChatMessageBound);
            sendChatButton.addEventListener('click', this.handleSendChatMessageBound);
        }
        
        // Enable chat input and send button (in case they were disabled from a previous session)
        if (chatInput) chatInput.disabled = false;
        if (sendChatButton) {
            sendChatButton.disabled = false;
            sendChatButton.textContent = 'Send';
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

    // --- 5. LLM INTERACTION LOGIC ---
    // Methods focused on preparing prompts and interacting with the LLM (via the helper).

    /**
     * Asynchronously gets an explanation for a given question from an LLM.
     * This method now constructs the specific prompt for an initial explanation
     * and uses the _fetchLlmResponse helper for the actual API call.
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

        // Use a try-catch block to handle potential errors from the _fetchLlmResponse call.
        try {
            // Delegate the actual API call to the new centralized helper method.
            // 'config' contains the LLM provider and API key.
            // 'basePrompt' is the fully constructed prompt string for this initial explanation.
            console.log("Calling _fetchLlmResponse for initial explanation...");
            const explanation = await this._fetchLlmResponse(config, basePrompt);
            
            // Return the text explanation received from the LLM.
            return explanation;
        } catch (error) {
            // If _fetchLlmResponse throws an error (e.g., API error, network issue),
            // log it and return a user-friendly error message.
            console.error('Error in getLlmExplanation while calling _fetchLlmResponse:', error.message);
            // This message will be displayed in the UI where the explanation was expected.
            return `Sorry, I couldn't fetch an explanation at this time. Error: ${error.message}`;
        }
    }

    // --- 6. CORE QUIZ LIFECYCLE & STATE ---
    // Methods related to the overall quiz flow, question management, and scoring.

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
     * Handle quiz completion and display final score
     * @param {boolean} [timeExpired=false] - Flag indicating if completion was due to time running out.
     */
    handleQuizCompletion(timeExpired = false) {
        this.stopTimer(); // Stop the timer when quiz completes

        // Ensure totalQuestions is not zero to avoid division by zero
        if (this.totalQuestions === 0) {
            alert("Quiz finished, but there were no questions.");
            return;
        }

        const percentage = Math.round((this.currentScore / this.totalQuestions) * 100);
        const incorrectAnswers = this.totalQuestions - this.currentScore;

        // Define the message based on whether time expired
        let completionMessage = timeExpired ? "Time's up!\n" : "Quiz Complete!\n";

        // Use the globally available showFinalScore function if it exists for better formatting, otherwise use alert
        if (typeof showFinalScore === 'function') {
             // Prepend the completion message to the score details from showFinalScore
            const scoreMessage = showFinalScore(this.currentScore, this.totalQuestions);
            alert(completionMessage + scoreMessage.replace(/^Quiz Complete!\n/, '')); // Attempt to remove duplicate header
        } else {
            // Fallback alert using the user's original detailed format
            alert(`${completionMessage}─────────────────────\nTotal Questions: ${this.totalQuestions}\nCorrect Answers: ${this.currentScore}\nIncorrect Answers: ${incorrectAnswers}\nFinal Score: ${percentage}%\n─────────────────────`);
        }
         // Optional: Disable all remaining inputs or provide a restart button? For now, just alert.
    }

    // --- 7. TIMER MANAGEMENT ---
    // All methods related to the quiz timer.

    /**
     * Starts the quiz timer using duration from input field.
     */
    startTimer() {
        console.log("Attempting to start timer. Enabled:", this.isTimerEnabled);
        // --- Check if timer is enabled ---
        if (!this.isTimerEnabled) {
            console.log("Timer is disabled. Not starting.");
            this.updateTimerDisplay(); // Update display to show 'Disabled' or similar
            return; // Exit function, do not start the timer
        }

        // Get duration from input
        const durationInput = document.getElementById('timerDurationInput');
        let durationMinutes = parseInt(durationInput.value, 10);

        // Validate input, set default if invalid
        if (isNaN(durationMinutes) || durationMinutes <= 0) {
            console.warn("Invalid timer duration input, using default (10 minutes).");
            durationMinutes = 10; // Default duration in minutes
            durationInput.value = 10; // Update input field to show default
        }

        this.timerDuration = durationMinutes * 60; // Convert minutes to seconds

        this.timeRemaining = this.timerDuration; // Set initial time based on input/default
        this.updateTimerDisplay(); // Show initial time immediately

        // Start countdown interval
        this.timerInterval = setInterval(() => {
            console.log(">>> Timer interval running, time remaining:", this.timeRemaining);
            this.timeRemaining--; // Decrement time
            this.updateTimerDisplay(); // Update UI

            // Check if time has run out
            if (this.timeRemaining <= 0) {
                this.stopTimer();
                // alert('Time is up!');
                console.log("Time expired. Disabling inputs.");
                this.disableAllInputs(); // Used to disable buttons
                this.handleQuizCompletion(true); // Pass flag indicating time ran out
            }
        }, 1000); // Update every second
        console.log("Timer started with duration (seconds):", this.timerDuration);
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
     * Resets the timer display and state.
     */
    resetTimer() {
        this.stopTimer(); // Stop any active timer
        this.timeRemaining = 0; // Reset time
        this.updateTimerDisplay(); // Update UI (will show 'Timer OFF' if disabled)
        console.log("Timer reset.");
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

    // --- 8. UI FEEDBACK & SPECIFIC INTERACTION HELPERS ---
    // Smaller methods that modify specific parts of the UI or assist event handlers.

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
             button.textContent = 'Timer ON';
             button.classList.remove('timer-off');
         } else {
             button.textContent = 'Timer OFF';
             button.classList.add('timer-off');
         }
     }


    // --- 9. "PRIVATE" HELPER METHODS ---
    // Internal utility methods, often prefixed with an underscore.

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

    /**
     * Private helper method to make API calls to the selected LLM provider.
     * This centralizes the fetch logic for different LLMs.
     * @param {object} llmConfig - Configuration for the LLM.
     * Example: { model: 'ollama'/'gemini-2.0-flash'/'perplexity', apiKey: 'YOUR_API_KEY_IF_NEEDED' }
     * @param {string} promptString - The fully prepared prompt string to send to the LLM.
     * @returns {Promise<string>} A promise that resolves with the LLM's text response.
     * @throws {Error} If the API call fails or the response format is unexpected.
     */
    async _fetchLlmResponse(llmConfig, promptString) {
        // This variable will store the final text response from the LLM.
        let textResponse = '';

        // Log the attempt to fetch, showing which provider and a snippet of the prompt for debugging.
        console.log(`Attempting to fetch LLM response from provider: ${llmConfig.model}. Prompt snippet: "${promptString.substring(0, 100)}..."`);

        // Use a switch statement to handle logic specific to each LLM provider.
        switch (llmConfig.model) {
            // ---- OLLAMA CASE ----
            case 'ollama': {
                // Define the local Ollama API endpoint.
                const ollamaEndpoint = 'http://localhost:11434/api/generate';
                // Define the specific Ollama model name to use.
                // This can be made more dynamic later (e.g., user selection or part of llmConfig).
                const modelName = "mistral:latest"; 
                console.log(`Workspaceing from Ollama (Model: ${modelName}).`);

                // Make the asynchronous POST request to the Ollama API.
                const response = await fetch(ollamaEndpoint, {
                    method: 'POST', // HTTP method
                    headers: { 
                        'Content-Type': 'application/json' // Specify that we're sending JSON data
                    },
                    body: JSON.stringify({ // Convert the JavaScript payload object to a JSON string
                        model: modelName,      // The Ollama model to use
                        prompt: promptString,  // The actual prompt content
                        stream: false          // Request the full response at once, not as a stream
                    }),
                });

                // Check if the HTTP response status indicates an error (e.g., 4xx or 5xx).
                if (!response.ok) {
                    let errorBody = await response.text(); // Try to get more error details from the response body
                    // Attempt to parse errorBody if it's JSON, to get a more specific error message from Ollama.
                    try { 
                        const errorJson = JSON.parse(errorBody); 
                        if (errorJson && errorJson.error) { errorBody = errorJson.error; } 
                    } catch (e) { /* If errorBody is not JSON, ignore parsing error and use the raw text. */ }
                    console.error(`Ollama API request failed with status: ${response.status}`, errorBody);
                    // Throw an error to be caught by the calling function.
                    throw new Error(`Ollama API Error (${response.status}): ${errorBody}`);
                }
                // If the request was successful, parse the JSON data from the response body.
                const data = await response.json();
                // Extract the LLM's text response from the 'response' field of the Ollama JSON structure.
                // Trim whitespace from the beginning and end.
                textResponse = data.response ? data.response.trim() : 'Error: Empty response from Ollama.';
                break; // Exit the switch statement for the 'ollama' case.
            }

            // ---- GEMINI CASE ----
            case 'gemini-2.0-flash': {
                // Check if an API key is provided, as Gemini requires it.
                if (!llmConfig.apiKey) {
                    throw new Error("API Key required for Google Gemini model.");
                }
                // Define the specific Gemini model name.
                const geminiModelName = "gemini-2.0-flash";
                // Construct the Gemini API endpoint URL, including the model name and API key.
                const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModelName}:generateContent?key=${llmConfig.apiKey}`;
                console.log(`Workspaceing from Gemini (Model: ${geminiModelName}).`);

                // Make the asynchronous POST request to the Gemini API.
                const response = await fetch(geminiEndpoint, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json' 
                    },
                    body: JSON.stringify({
                        // Gemini API expects a 'contents' array, where each item represents a turn or part of a turn.
                        // For simplicity in this refactoring, we send the entire 'promptString' as a single text part.
                        contents: [{ 
                            parts: [{ 
                                text: promptString 
                            }] 
                        }],
                        // Optional: You could add 'generationConfig' or 'safetySettings' here if needed
                        // for all Gemini calls, or pass them via an extended llmConfig.
                    }),
                });

                // Check if the HTTP response status indicates an error.
                if (!response.ok) {
                    let errorMsg = `Gemini API request failed: ${response.status}`;
                    try {
                        const errorData = await response.json(); // Try to parse error details from Gemini
                        if (errorData && errorData.error && errorData.error.message) {
                            errorMsg += `: ${errorData.error.message}`;
                        }
                    } catch (e) { /* If error response body isn't JSON, ignore. */ }
                    console.error(errorMsg);
                    throw new Error(errorMsg); // Propagate the error.
                }
                // If successful, parse the JSON data from the response.
                const data = await response.json();
                // Extract the LLM's text response from Gemini's 'candidates' structure.
                if (data.candidates && data.candidates.length > 0 && 
                    data.candidates[0].content?.parts?.[0]?.text) {
                    textResponse = data.candidates[0].content.parts[0].text.trim();
                } else {
                    // Check if the response was blocked due to safety settings.
                    if (data.promptFeedback?.blockReason) {
                        throw new Error(`Gemini request blocked by safety settings (${data.promptFeedback.blockReason}).`);
                    }
                    // If the response format is unexpected, log and throw an error.
                    console.error("Unexpected Gemini response format:", data);
                    throw new Error('Error: Unexpected response format from Gemini.');
                }
                break; // Exit the switch statement for the 'gemini-2.0-flash' case.
            }

            // ---- PERPLEXITY CASE ----
            case 'perplexity': {
                // Check if an API key is provided for Perplexity.
                if (!llmConfig.apiKey) {
                    throw new Error("API Key required for Perplexity model.");
                }
                // Define the Perplexity API endpoint for chat completions.
                const perplexityEndpoint = 'https://api.perplexity.ai/chat/completions';
                // Define the specific Perplexity model name. Adjust as needed.
                const perplexityModelName = "sonar"; 
                console.log(`Workspaceing from Perplexity (Model: ${perplexityModelName}).`);
                
                // Perplexity's chat completions API expects a 'messages' array.
                // We send our 'promptString' as the content of a single "user" message.
                const messages = [{ role: "user", content: promptString }];
                // Optional: A system message could be prepended to the 'messages' array if needed.
                // messages.unshift({ role: "system", content: "You are an expert tutor." });

                // Make the asynchronous POST request to the Perplexity API.
                const response = await fetch(perplexityEndpoint, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${llmConfig.apiKey}`, // Perplexity uses Bearer token authentication
                        'Content-Type': 'application/json',
                        'Accept': 'application/json', // Indicate we expect JSON back
                    },
                    body: JSON.stringify({
                        model: perplexityModelName, // The Perplexity model to use
                        messages: messages,          // The array of messages
                        // Optional: Add parameters like 'temperature', 'max_tokens', etc.
                    }),
                });

                // Check if the HTTP response status indicates an error.
                if (!response.ok) {
                    let errorMsg = `Perplexity API request failed: ${response.status}`;
                    try {
                        const errorData = await response.json(); // Try to parse error details
                        // Perplexity's error details might be in errorData.detail
                        if (errorData && errorData.detail) {
                             errorMsg += `: ${JSON.stringify(errorData.detail)}`; // Convert detail to string
                        } else if (response.statusText) { // Fallback to statusText
                            errorMsg += `: ${response.statusText}`;
                        }
                    } catch (e) {  
                        errorMsg += `: ${response.statusText || "Could not retrieve error details."}`; 
                    }
                    console.error(errorMsg);
                    throw new Error(errorMsg); // Propagate the error.
                }
                // If successful, parse the JSON data.
                const data = await response.json();
                // Extract the LLM's text response from Perplexity's 'choices' structure.
                if (data.choices && data.choices.length > 0 && 
                    data.choices[0].message?.content) {
                    textResponse = data.choices[0].message.content.trim();
                } else {
                    // If the response format is unexpected, log and throw an error.
                    console.error("Unexpected Perplexity response format:", data);
                    throw new Error('Error: Unexpected response format from Perplexity.');
                }
                break; // Exit the switch statement for the 'perplexity' case.
            }

            // ---- NO MODEL SELECTED CASE ----
            case 'none':
                // If 'none' was selected in the UI, set a message or throw an error.
                textResponse = "Please select an LLM model.";
                // Alternatively, to be consistent with other error handling:
                // throw new Error("No LLM model selected."); 
                break;

            // ---- DEFAULT CASE (Unsupported Model) ----
            default:
                // If llmConfig.model doesn't match any known cases.
                console.warn(`Unsupported LLM model specified for fetching: ${llmConfig.model}`);
                throw new Error(`Unsupported LLM model: ${llmConfig.model}`);
        }
        // Return the extracted text response.
        return textResponse;
    }

}

const examManager = new ExamManager();
