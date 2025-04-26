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

        // Bound event handlers to maintain 'this' context
        this.handleFileUploadBound = this.handleFileUpload.bind(this);
        this.handleSubmitClickBound = this.handleSubmitClick.bind(this);
        this.handleExplainClickBound = this.handleExplainClick.bind(this);

        this.initializeEventListeners(); // Initial listeners (file, timer)
    }

    /**
     * Starts the quiz timer using duration from input field.
     */
    startTimer() {
        // Clear any existing timer
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
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
        this.timeRemaining = 0; // Or set to default duration if you prefer
        this.updateTimerDisplay(); // Update UI to show reset time
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
    async handleExplainClick(event) { // <<< Make this method async
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

        // Display the actual explanation or error message
        if (responseArea) {
            responseArea.textContent = explanation;
        }

        // Re-enable the button and reset text
        button.disabled = false;
        button.textContent = 'Explain';
        console.log("LLM interaction complete.");
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

        Act as an expert Tutor and Subject Matter Expert. Your primary goal is to provide **concise, direct, and informative explanations** for multiple-choice questions to help a test taker quickly understand *why* the correct answer is right and *why* the incorrect answers are wrong. Prioritize clarity and brevity for efficient learning.

        **Task:**

        Analyze the provided multiple-choice question and its options. Deliver a focused explanation structured as follows:

        1.  **Essential Concept (Optional, 1 Sentence Max):** If a single core principle is essential to differentiate the answers, state it very briefly. Otherwise, omit this section.
        2.  **Answer Analysis:**
            * **Correct Answer (Identify Letter, e.g., C):** Succinctly explain *why* this option is the correct answer. Directly reference the key fact, calculation, or concept that validates it.
            * **Incorrect Answers (Identify Letters, e.g., A, B, D):** For *each* incorrect option, provide a brief and direct explanation of *why* it is wrong. State the specific flaw (e.g., "Incorrect because...", "Irrelevant factor...", "Misinterprets term X...").
        3.  **Key Term Definition(s) (Optional):** If a crucial technical term *within the question or answers* is likely unfamiliar and essential for understanding the explanation, define it very briefly (list format if multiple). Otherwise, omit this section.

        **Output Requirements & Constraints:**

        * **Concise & Direct:** Get straight to the point. Use clear, economical language. Avoid introductory fluff, verbose descriptions, or excessive background detail.
        * **Accuracy:** Ensure explanations are factually correct.
        * **Targeted Informativeness:** Focus squarely on the information *needed* to understand the reasoning for *this specific question's* answers.
        * **Structure:** Follow the requested structure (Concept -> Answers -> Terms). Use Markdown for clarity (e.g., bolding answer letters **A**, **B**, **C**, **D**).
        * **DO NOT** restate the provided question.
        * **DO NOT** use conversational filler (e.g., "Let's break this down," "Okay, I'm ready," "This question asks about...").
        * **Directly provide the analysis** immediately following these instructions.

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

            // Gemini API Use
            case 'gemini': {
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
        // << MODIFIED >>: Pass inputType to disable correct elements
        this.disableQuestionInputs(answerFieldset, submitButton, inputType);
        // << MODIFIED >>: Pass inputType to style correct elements
        this.showFeedback(container, feedbackElement, isCorrect, questionData.correct, inputType);

        // --- Update Progress (Unchanged logic) ---
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
            // It tries to find these two elements INSIDE the current optionDiv:
            const input = optionDiv.querySelector(`input[type="${inputType}"]`);
            const label = optionDiv.querySelector('.answer-label');
        
            // If EITHER input OR label is not found, this condition becomes true:
            if (!input || !label) {
                 console.warn("Loop iteration skipped: Couldn't find input or label."); // <<< YOUR WARNING
                 return; // Skip this iteration
            }

            const letter = input.value;
            const isChecked = input.checked;
            // Explicitly check if the current letter is in the correctLetters array
            const isCorrectLetter = correctLetters.includes(letter);

            // *** ADD THIS DETAILED LOG ***
            console.log(`Processing --> Letter: ${letter}, User Checked: ${isChecked}, Is Correct Answer: ${isCorrectLetter}`);

            // Reset classes first
            label.classList.remove('correct', 'incorrect', 'missed');

            // Now apply logic based on the logged variables
            if (isChecked) { // If this option was selected by the user
                if (isCorrectLetter) {
                    // console.log(`Adding 'correct' to label for ${letter}`); // Optional log
                    label.classList.add('correct'); // Selected and correct
                } else {
                    // console.log(`Adding 'incorrect' to label for ${letter}`); // Optional log
                    label.classList.add('incorrect'); // Selected but incorrect
                }
            } else { // If this option was NOT selected by the user
                if (isCorrectLetter) { // Check if this UNCHECKED answer IS in the correct list
                    // console.log(`Adding 'missed' to label for letter: ${letter}`); // Optional log
                    label.classList.add('missed'); // Not selected, but should have been
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


}

const examManager = new ExamManager();
