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
     * Handle file upload and process questions
     * @param {Event} event - File input change event
     */
    async handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
    
        try {
            const text = await this.readFileContent(file);
            
            // Parse questions first
            const questions = parseQuestions(text);
            console.log('Number of questions:', questions.length);
            
            // Initialize quiz state
            this.totalQuestions = questions.length;
            this.answeredQuestions = 0;
            this.currentScore = 0;
            
            // Process questions and update display
            if (processQuestions(text)) {
                // Update score display
                updateScoreDisplay(this.currentScore, this.answeredQuestions, this.totalQuestions);
                // Initialize our own answer listeners
                this.initializeAnswerListeners();
            }
            
        } catch (error) {
            console.error('Error processing file:', error);
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
            button.addEventListener('click', (e) => this.handleAnswerClick(e));
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
        button.classList.add(isCorrect ? 'correct' : 'incorrect');
        const feedback = container.querySelector('.feedback');
        feedback.textContent = isCorrect ? 'Correct!' : 'Incorrect!';
        feedback.classList.add(isCorrect ? 'correct' : 'incorrect');
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
