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

        // Initialize file upload listener
        this.initializeEventListeners();
    }

    /**
     * Set up event listeners for file upload
     */
    initializeEventListeners() {
        document.getElementById('questionFile')
            .addEventListener('change', (e) => this.handleFileUpload(e));
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
                    // Assuming files[index] corresponds correctly might be fragile if non-txt files were skipped.
                    // A safer way would be to track filenames alongside content.
                    // Let's refine this slightly by processing successfully read files.
                    // We'll parse content directly here.
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
                this.initializeAnswerListeners();
                console.log('Answer listeners initialized.');
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

            // Assuming resetDisplays is globally available from ui.js or defined elsewhere
            // Make sure it's called *after* setting this.totalQuestions and rendering
            resetDisplays(this.totalQuestions);

            return true; // Indicate success
        } else {
            console.error('Validation errors:', validationErrors);
            // Construct a user-friendly error message
            let errorMsg = 'Error in question format. Please check the file.\nDetails:\n';
            validationErrors.forEach(err => errorMsg += `- ${err}\n`);
            alert(errorMsg);
            document.getElementById('quiz-content').innerHTML = `<p style="color: red;">${errorMsg.replace(/\n/g, '<br>')}</p>`;
            resetDisplays(0); // Reset displays to zero
            return false; // Indicate failure
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
    */
    handleQuizCompletion() {
    const percentage = Math.round((this.currentScore / this.totalQuestions) * 100);
    const incorrectAnswers = this.totalQuestions - this.currentScore;
    
    alert(`Quiz Complete!
    ─────────────────────
    Total Questions: ${this.totalQuestions}
    Correct Answers: ${this.currentScore}
    Incorrect Answers: ${incorrectAnswers}
    Final Score: ${percentage}%
    ─────────────────────`);
    }
        
}

const examManager = new ExamManager();
