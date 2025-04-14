// Manages quiz state and interactions

class ExamManager {
    /**
     * Initialize exam manager with default state
     */
    constructor() {
        // Quiz state
        this.totalQuestions = 0;
        this.answeredQuestions = 0;
        this.currentScore = 0;
        this.questions = []; // Used to initialize questions property

        this.timerInterval = null; // To store the interval ID for stopping
        this.timeRemaining = 0; // Time remaining in seconds
        this.timerDuration = 0.5 * 60; // <<< Default/Hardcoded: 10 minutes (in seconds)

        // Initialize file upload listener
        this.initializeEventListeners();
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

        // Keep the console log for debugging if needed
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
     * Set up event listeners for file upload AND timer input validation.
     */
    initializeEventListeners() {
        // Listener for file input
        document.getElementById('questionFile')
            .addEventListener('change', (e) => this.handleFileUpload(e));

        const timerInput = document.getElementById('timerDurationInput');
        if (timerInput) {
            timerInput.addEventListener('input', function() {
                // Remove any character that is NOT a digit
                // Allows digits 0-9, removes everything else
                this.value = this.value.replace(/[^0-9]/g, '');

                // Optional: Prevent leading zeros if number > 0, though parseInt handles this later
                 if (this.value.length > 1 && this.value.startsWith('0')) {
                     this.value = this.value.substring(1);
                 }
                 // Ensure value isn't empty, reset to '1' if user deletes everything
                 // Note: 'min="1"' attribute handles this on blur/submit, but this gives immediate feedback
                  if (this.value === '') {
                      this.value = '1';
                  }


            });
             // Add listener for 'blur' event to enforce min/max if needed
              timerInput.addEventListener('blur', function() {
                  const min = parseInt(this.min, 10) || 1; // Default min 1
                  const max = parseInt(this.max, 10) || 180; // Default max 180
                  let currentValue = parseInt(this.value, 10);
             
                  if (isNaN(currentValue) || currentValue < min) {
                      this.value = min;
                  } else if (currentValue > max) {
                      this.value = max;
                  }
              });
        } else {
            console.error("Timer duration input element not found!");
        }
    }

    /**
     * Handle file upload and process questions from multiple files
     * @param {Event} event - File input change event
     */
    async handleFileUpload(event) {
        const files = event.target.files; // Get the FileList object
        if (!files || files.length === 0) {
            console.log("No files selected.");
            return; // Exit if no files selected
        }

        console.log(`Processing ${files.length} file(s)...`);
        let allQuestions = []; // Array to hold questions from all files
        let fileReadPromises = []; // Array to hold promises for reading files

        // Create promises for reading each file
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            // Check if the file is a .txt file (optional, but good practice)
            if (file.name.endsWith('.txt') && file.type === 'text/plain') {
                 console.log(`Reading file: ${file.name}`);
                 fileReadPromises.push(this.readFileContent(file).catch(e => ({ error: e, fileName: file.name }))); // Catch errors per file
            } else {
                 console.warn(`Skipping non-TXT file: ${file.name}`);
            }
        }

        try {
            // Wait for all file reading promises to resolve
            const fileContents = await Promise.all(fileReadPromises);

            // Parse questions from each file's content
            fileContents.forEach((content, index) => {
                 if (content.error) {
                      console.error(`Error reading file ${content.fileName}:`, content.error);
                      alert(`Could not read file: ${content.fileName}. Skipping.`);
                      return; // Skip this file
                 }
                 try {

                    console.log(`Parsing content from file ${index + 1}...`); // Use index for logging
                    const parsedQuestions = parseQuestions(content); // Use parseQuestions from parser.js
                    if (parsedQuestions && parsedQuestions.length > 0) {
                        allQuestions = allQuestions.concat(parsedQuestions);
                        console.log(`Added ${parsedQuestions.length} questions. Total now: ${allQuestions.length}`);
                    } else {
                         console.warn(`No questions parsed from file ${index + 1}.`);
                    }
                 } catch(parseError) {
                      console.error(`Error parsing content from file ${index + 1}:`, parseError);
                      alert(`Could not parse questions from file ${index + 1}. Skipping.`);
                 }
            });


            if (allQuestions.length === 0) {
                alert("No questions were successfully parsed from the selected file(s).");
                resetDisplays(0);
                return;
            }

            console.log(`Total questions from all files: ${allQuestions.length}`);

            // Question Shuffling & Renumbering on COMBINED list
            this.questions = this.shuffleArray(allQuestions);
            console.log('Shuffled combined questions.');
            this.renumberQuestions(); // Renumber the combined list
            console.log('Combined questions renumbered.');

            // Initialize quiz state based on COMBINED questions
            this.totalQuestions = this.questions.length;
            this.answeredQuestions = 0;
            this.currentScore = 0;

            // Validate and display the combined & shuffled questions
            if (this.validateAndDisplayQuestions(this.questions)) {
                console.log('Combined questions validated and displayed.');
                this.startTimer(); // Initiates timer
            } else {
                console.log('Validation or display failed for combined questions.');
            }

        } catch (error) {
            // This catch might be less likely if individual file errors are handled
            console.error('General error processing files:', error);
            alert('An error occurred while processing the files. Please check the console.');
            resetDisplays(0);
        }
         // Clear the file input value to allow re-uploading the same file(s) if needed
         event.target.value = null;
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
     * Validates and displays questions.
     * @param {Array} questions - The array of (shuffled) question objects.
     * @returns {boolean} True if validation passes and display occurs, false otherwise.
     */
    validateAndDisplayQuestions(questions) {
        // Assuming validateQuestions is globally available from parser.js
        const validationErrors = validateQuestions(questions);

        if (validationErrors.length === 0) {
            // Assuming displayQuestions is globally available from ui.js
            const htmlContent = displayQuestions(questions);
            document.getElementById('quiz-content').innerHTML = htmlContent; // Render questions

            this.resetTimer(); // Reset timer before resetting displays
            resetDisplays(this.totalQuestions);

            this.initializeAnswerListeners(); // Initialize answer buttons
            this.initializeExplainListeners(); // Initialize explain buttons

            console.log("Answer and Explain initialized.")

            return true; // Indicate success

        } else {
            console.error('Validation errors:', validationErrors);
            // Construct a user-friendly error message
            let errorMsg = 'Error in question format. Please check the file.\nDetails:\n';
            validationErrors.forEach(err => errorMsg += `- ${err}\n`);
            alert(errorMsg);
            document.getElementById('quiz-content').innerHTML = `<p style="color: red;">${errorMsg.replace(/\n/g, '<br>')}</p>`;

            this.resetDisplays(); // Still resetting timer if function fails.
            resetDisplays(0); // Reset displays to zero
            return false; // Indicate failure
        }
    }

    /**
     * Adds click event listeners to all "Explain" buttons.
     */
    initializeExplainListeners() {
        const explainButtons = document.querySelectorAll('.explain-btn');
        console.log(`Found ${explainButtons.length} explain buttons.`); // Debug log

        explainButtons.forEach(button => {
            // Remove potential existing listener to prevent duplicates on re-load
            if (this.handleExplainClickBound) {
                 button.removeEventListener('click', this.handleExplainClickBound);
            }
            // Bind the handler function to the current ExamManager instance
            this.handleExplainClickBound = this.handleExplainClick.bind(this);
            button.addEventListener('click', this.handleExplainClickBound);
        });
        console.log("Explain button listeners initialized.");
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
                                    text: basePrompt // Send the combined prompt
                                }]
                            }],
                             // Optional: Add generationConfig or safetySettings here if needed
                             // "generationConfig": { "temperature": 0.7 },
                             // "safetySettings": [ ... ]
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

                    // Extract the response (structure based on Gemini REST API docs)
                    // It might be slightly different depending on model/version
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

            default: { // Handle 'none' or unsupported selections
                console.warn(`Unsupported LLM model selected: ${config.model}`);
                // Return a promise that resolves, consistent with async function
                return Promise.resolve(`Please select a valid LLM model.`);
            } // End default case

        } 
    }


    // Initialize quiz with parsed questions
     
    initializeQuiz(questions) {
        this.totalQuestions = questions.length;
        this.answeredQuestions = 0;
        this.currentScore = 0;
        
        resetDisplays(this.totalQuestions);
        const htmlContent = displayQuestions(questions); 
        console.log("Generated HTML:", htmlContent);      
        displayQuestions(questions);
        this.initializeAnswerListeners();
    }

    // Initialize answer button click listeners
    initializeAnswerListeners() {
        document.querySelectorAll('.answer-btn').forEach(button => {
             // Remove existing listeners first to prevent duplicates if re-initializing
            if (this.handleAnswerClickBound) { // Check if bound method exists
                 button.removeEventListener('click', this.handleAnswerClickBound);
            }
        });
        // Now add the listeners
        document.querySelectorAll('.answer-btn').forEach(button => {
            // Bind the handleAnswerClick method to the current instance ('this')
            // Store the bound function so it can be removed later
            this.handleAnswerClickBound = this.handleAnswerClick.bind(this);
            button.addEventListener('click', this.handleAnswerClickBound);
        });
    }

    /**
     * Handle answer button clicks
     * @param {Event} event - Click event
     */
    handleAnswerClick(event) {
        const button = event.currentTarget;
        const questionNumber = button.getAttribute('data-question');
        const container = document.getElementById(`container-${questionNumber}`);
        const isCorrect = button.getAttribute('data-correct') === 'true';
        
        this.disableQuestionButtons(container);
        this.showFeedback(button, container, isCorrect);
        this.updateProgress(isCorrect);
    }

    /**
     * Disable all answer buttons for a question
     * container - Question container
     */
    disableQuestionButtons(container) {
        container.querySelectorAll('.answer-btn').forEach(btn => {
            btn.disabled = true;
        });
    }

    /**
     * Disables all answer buttons in the entire quiz.
     * Typically called when the timer expires.
     */
    disableAllInputs() {
        document.querySelectorAll('.answer-btn').forEach(btn => {
            // Check if it's not already disabled by answering the specific question
            if (!btn.disabled) {
                 btn.disabled = true;
                 // Optionally add a specific class to indicate disabled by timer
                 // btn.classList.add('disabled-by-timer');
            }
        });
        console.log("All answer buttons disabled.");
    }


    /**
    * Show feedback for answered question
    * button - Clicked button
    * container - Question container
    * isCorrect - Whether answer was correct
    */
    showFeedback(button, container, isCorrect) {
        if (isCorrect) {
            button.classList.add('correct');
            const feedback = container.querySelector('.feedback');
            feedback.textContent = 'Correct!';
            feedback.classList.add('correct');
        } else {
            // Add incorrect class to clicked button
            button.classList.add('incorrect');
            // Find and highlight the correct answer
            const correctButton = Array.from(container.querySelectorAll('.answer-btn'))
                .find(btn => btn.getAttribute('data-correct') === 'true');
            correctButton.classList.add('correct');
        
            const feedback = container.querySelector('.feedback');
            feedback.textContent = 'Incorrect!';
            feedback.classList.add('incorrect');
        }
    }


    /**
     * Update progress and score displays
     * isCorrect - Whether answer was correct
     */
    updateProgress(isCorrect) {
        if (isCorrect) this.currentScore++;
        this.answeredQuestions++;
        
        // Make sure we're passing all three parameters
        updateScoreDisplay(
            this.currentScore,          // current correct answers
            this.answeredQuestions,     // total answered
            this.totalQuestions         // total questions
        );
        updateProgressBar(this.answeredQuestions, this.totalQuestions);
    
        if (this.answeredQuestions === this.totalQuestions) {
            this.handleQuizCompletion();
        }
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
