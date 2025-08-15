# QA Gen

> A local and customizable web-based application for interactive learning and exam preparation. It lets you import your own multiple-choice questions from a text file and take interactive quizzes in a clean, modern interface. It was built for anyone who wants a straightforward way to practice and learn their material.

## ✨ Features

* **✌️ Dual Quiz Modes**:

  * **Study Mode**: Get immediate, color-coded feedback after each answer.
  * **Exam Mode**: Simulate a real test with a final grade revealed only at the end.

* **🤖 AI-Powered Explanations**: Get detailed explanations for any question by connecting to LLM provider (Ollama, OpenAI, Gemini, Perplexity).

## 🚀 Getting Started

1. **Clone the Repository**

    ```bash
    git clone https://github.com/chumphrey-cmd/QA-Generator.git
    ```

2. **Generate Questions to be Ingested**

    > Need to create questions from your existing study materials like PDFs or course notes?

    * If your content is in PDFs, you can extract the text using a tool like my [PDF-Extractor](https://github.com/chumphrey-cmd/Password-Protected-PDF-Extractor).

    * Use a modern AI tool like Google's [NotebookLM](https://notebooklm.google/) to analyze your extracted text and generate multiple-choice questions that match the **Questions File Format** below.

3. **Launch the App**
    Open the `quiz.html` file in any modern web browser (like Chrome, Firefox, or Edge).

4. **Import & Go**
    Use the navigation bar to import your `.txt` question file and start your quiz!

## 📝 Question File Format

Your questions **must** follow this simple format. Ensure there is one blank line between each question block, and mark the correct answer with a trailing asterisk (**`*`**). You also have the ability to select multiple correct answers.

```text
1. What is the capital of France?
A. Berlin
B. Madrid
C. Paris*
D. Rome

2. Which planet is known as the Red Planet?
A. Earth
B. Mars*
C. Jupiter
D. Saturn

3. Select all of the following that are numbers.
A. 1*
B. 2*
C. 3*
D. $
E. 5*
F. ^
```
