# Simple Quiz Generator

A local and super simple web-based exam/quiz application that allows users to import questions from text files and take interactive quizzes with real-time feedback. 

Personally I just wanted a way to quickly take exams on the content that I was reading.

## Generate Questions to be Ingested

1. If using PDFs, use my [PDF-Extractor](https://github.com/chumphrey-cmd/Password-Protected-PDF-Extractor) tool get the text from courses that you're working on.

2. Use something like Google's [NotebookLM](https://notebooklm.google/) as a RAG layer to query and generate multiple choice questions matching the **Question File Format** below.

## Question File Format

Questions **MUST** be formatted as follows:

```
1. Question text here?
A. First answer
B. Second answer
C. Third answer*
D. Fourth answer

2. Next question...
```
- One blank line between questions
- Correct answer marked with asterisk (*)

## Setup

1. Clone the repository

```bash
git clone https://github.com/chumphrey-cmd/QA-Generator.git
```

2. Open `quiz.html` in a modern web browser
3. Import a properly formatted `.txt` file
4. Start taking the quiz

## To-Do List:

### In Progress... ⏳

* **Local Database:** 
  * Be able to store and save your quiz questions into a backend/quiz bank using a local database for reference later...
  * Implement the ability to specify the number of questions that you want to display at a time (e.g., 90/120 total questions)
  * Have the ability to pause, save, or reset your current session while you are reviewing. 
  * Have the ability to re-initiate your current saved session to restart your progress.

* **UI/UX:** 
  * Create a nice splash/introduction page/logo for the tool when the user first opens up the quiz.html file.
  * Ensure that the entire quiz header is pinned while we scroll down the MC Qs.