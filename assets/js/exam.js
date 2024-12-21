class ExamManager {
    constructor() {
        this.score = 0;
        this.totalQuestions = 0;
        this.currentQuestion = 0;
        this.timeRemaining = 0;
    }

    initializeExam(questions) {
        this.totalQuestions = questions.length;
        this.updateProgress();
        this.initializeTimer();
    }

    updateScore(isCorrect) {
        if (isCorrect) this.score++;
        this.updateScoreDisplay();
    }

    updateProgress() {
        this.currentQuestion++;
        // Update progress bar and text
    }
}
