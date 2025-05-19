// Manages quiz state and interactions
class ExamManager {
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
     * --- ADDED: Handles clicks on the timer toggle button ---
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


    /**
     * Handle file upload, parse, validate, display, and set up dynamic listeners.
     * Includes added console logs for debugging.
     */
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

    // Read file as text
    readFileContent(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('File reading failed'));
            reader.readAsText(file);
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
     * Re-numbers questions sequentially after shuffling.
     */
    renumberQuestions() {
        this.questions.forEach((question, index) => {
            question.number = index + 1; // Renumber starting from 1
        });
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
     * Asynchronously gets an explanation for given text from an LLM.
     * Includes answer options in the prompt. Routes based on selected model.
     * Includes cases for Ollama, Gemini, and Perplexity
     * @param {string} questionText - The text of the question to explain.
     * @param {Array} questionAnswers - The array of answer objects [{letter: 'A', text: '...'}].
     * @param {object} config - Configuration object { model: string, apiKey: string }.
     * @returns {Promise<string>} A promise that resolves with the explanation string or an error message.
     */

    async getLlmExplanation(questionText, questionAnswers, config) {
        console.log("Requesting LLM explanation for:", questionText);
        console.log("Using config:", config);

        // Format answers for the prompt (used by most models)
        const formattedAnswers = questionAnswers.map(ans => `${ans.letter}. ${ans.text}`).join('\n');
        
        // Enhanced prompt focused on concise, direct explanations for test-takers
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

        **(LLM would then immediately generate the analysis based on the structure above)**

        ---

        **QUESTION TO ANALYZE:**

        Question: "${questionText}"

        Options:
        ${formattedAnswers}`;

        // --- Route based on selected model ---
        switch (config.model) {
            case 'ollama': {
                // --- Ollama Specific Logic ---
                const ollamaEndpoint = 'http://localhost:11434/api/generate'; // Default Ollama endpoint
                // Specify a model available in your Ollama instance
                const modelName = "mistral:latest"; // Customize as needed

                try {
                    console.log(`Sending request to Ollama (${modelName})...`);
                    const response = await fetch(ollamaEndpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            model: modelName,
                            prompt: basePrompt,
                            stream: false // Request a single response object
                        }),
                    });

                    if (!response.ok) {
                        console.error(`Ollama API request failed with status: ${response.status}`);
                        let errorBody = '';
                        try { errorBody = await response.text(); const errorJson = JSON.parse(errorBody); if (errorJson && errorJson.error) { errorBody = errorJson.error; } } catch (e) { /* Ignore */ }
                        return `Error: Could not connect to Ollama or model not found (Status: ${response.status}). ${errorBody}. Make sure Ollama is running and the model '${modelName}' is available.`;
                    }
                    const data = await response.json();
                    console.log("Ollama response data received.");
                    // Extract the explanation (adjust data.response if Ollama's structure differs)
                    return data.response ? data.response.trim() : 'Error: Received an empty explanation from Ollama.';
                } catch (error) {
                    console.error('Error fetching explanation from Ollama:', error);
                    if (error instanceof TypeError && error.message.includes('fetch')) {
                        return 'Error: Could not fetch from Ollama endpoint. Is the service running at http://localhost:11434?';
                    }
                    return `Error: An unexpected error occurred while contacting the LLM. (${error.message})`;
                }
            }

            // Gemini 2.0 Flash API Use
            case 'gemini-2.0-flash': {
                console.log("Attempting to call Google Gemini");
                if (!config.apiKey) {
                    return Promise.resolve("Error: API Key required for Google Gemini model.");
                }
                 const geminiModel = "gemini-2.0-flash"; 
                 const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${config.apiKey}`;

                try {
                    console.log(`Sending request to Gemini (${geminiModel})...`);
                    const response = await fetch(geminiEndpoint, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        // Body structure specific to Gemini API
                        body: JSON.stringify({
                            contents: [{
                                parts: [{
                                    text: basePrompt // Combined base prompt
                                }]
                            }],
                             // Optional: Add generationConfig or safetySettings here if needed
                             // "generationConfig": { "temperature": 0.7 },
                        }),
                    });

                    if (!response.ok) {
                         // Try to parse error message from Gemini
                        let errorMsg = `Google Gemini API request failed (Status: ${response.status})`;
                        try {
                            const errorData = await response.json();
                            if (errorData && errorData.error && errorData.error.message) {
                                 errorMsg += `: ${errorData.error.message}`;
                            }
                        } catch (e) { /* Ignore if response body isn't JSON */ }
                        console.error(errorMsg);
                        return `Error: ${errorMsg}`;
                    }

                    const data = await response.json();
                    console.log("Gemini response data received.");

                    if (data.candidates && data.candidates.length > 0 &&
                        data.candidates[0].content && data.candidates[0].content.parts &&
                        data.candidates[0].content.parts.length > 0 && data.candidates[0].content.parts[0].text) {
                        return data.candidates[0].content.parts[0].text.trim();
                    } else {
                        console.error("Unexpected Gemini response format:", data);
                         // Check if blocked by safety settings
                         if (data.promptFeedback?.blockReason) {
                              return `Error: Request blocked by safety settings (${data.promptFeedback.blockReason}).`;
                         }
                        return 'Error: Received an unexpected response format from Google Gemini.';
                    }
                } catch (error) {
                    console.error('Error fetching explanation from Google Gemini:', error);
                     return `Error: An unexpected error occurred while contacting Google Gemini. (${error.message})`;
                }
            } // End of Gemini Case

            // Perplexity Sonar API use
            case 'perplexity': {
                const perplexityEndpoint = 'https://api.perplexity.ai/chat/completions';
                const perplexityModel = "sonar";
                try {
                   console.log(`Sending request to Perplexity (${perplexityModel})...`);
                    const response = await fetch(perplexityEndpoint, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${config.apiKey}`
                        },
                        body: JSON.stringify({
                            model: perplexityModel,
                            messages: [ { role: "user", content: basePrompt } ],
                            // temperature: 0.7, max_tokens: 500, // Optional
                        }),
                    });
                     if (!response.ok) {
                        let errorMsg = `Perplexity API Error (${response.status})`;
                        // Try to parse Perplexity's specific error format if available
                        try { const errorData = await response.json(); errorMsg += `: ${errorData?.detail?.[0]?.msg || errorData?.detail || 'Unknown error'}`; } catch (e) { /* Ignore */ }
                        console.error(errorMsg); return `Error: ${errorMsg}`;
                    }
                    const data = await response.json();
                    // Extract response text
                    const text = data.choices?.[0]?.message?.content;
                    if (text) { return text.trim(); }
                    else { console.error("Unexpected Perplexity response format:", data); return 'Error: Unexpected response format from Perplexity.'; }
                } catch (error) {
                     console.error('Error fetching from Perplexity:', error);
                     return `Error contacting Perplexity: ${error.message}`;
                }
           } // End Perplexity Case

            default: { // Handle 'none' or unsupported selections
                console.warn(`Unsupported LLM model selected: ${config.model}`);
                // Return a promise that resolves, consistent with async function
                return Promise.resolve(`Please select a valid LLM model.`);
            } // End default case

        } 
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

        // << REVISED >>: Get selected values based on input type
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

    // Method to initiate the chat interface
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

    // Method to display a chat message
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

    // (Partial) method to handle sending a chat message
    async handleSendChatMessage(event) {
        const button = event.currentTarget; // The "Send" button that was clicked
        const questionNumber = parseInt(button.dataset.questionNumber);
        const chatInput = document.getElementById(`chat-input-${questionNumber}`);

        if (!chatInput || !chatInput.value.trim()) {
            // Don't send empty messages
            return;
        }

        const userMessage = chatInput.value.trim();

        // 1. Display the user's message immediately
        this.displayChatMessage(userMessage, 'user', questionNumber);

        // 2. Clear the input field
        chatInput.value = '';

        // 3. Disable input and send button while waiting for LLM
        chatInput.disabled = true;
        button.disabled = true;
        button.textContent = 'Sending...';

        console.log(`User message for Q${questionNumber}: "${userMessage}" - Ready to send to LLM.`);

        // --- THIS IS WHERE THE NEXT PHASE OF WORK WILL HAPPEN ---
        // TODO:
        //  a. Get chat history (if maintaining complex history, otherwise just the new userMessage and perhaps context of initial question/explanation)
        //  b. Construct the prompt for the LLM.
        //  c. Call an LLM API function (you might adapt getLlmExplanation or create a new one like getLlmChatResponse).
        //      Example: const llmResponse = await this.getLlmChatResponse(userMessage, questionData, chatHistory, llmConfig);
        //  d. Display LLM's response: this.displayChatMessage(llmResponse, 'llm', questionNumber, false); // false for isHtml, so it gets parsed
        //  e. Re-enable input and send button:
        //     chatInput.disabled = false;
        //     button.disabled = false;
        //     button.textContent = 'Send';
        // --- END OF TODO FOR NEXT PHASE ---

        // For now, to demonstrate, let's just re-enable the button after a delay (remove this in the next phase)
        setTimeout(() => {
            if (!this.isDestroyed) { // Check if component/manager is still active if applicable
                 chatInput.disabled = false;
                 button.disabled = false;
                 button.textContent = 'Send';
                 console.log("Mock LLM response finished. UI enabled.");
            }
        }, 1000); // Simulating LLM response time
    }


}

const examManager = new ExamManager();
