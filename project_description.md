# QA-Generator Project  

## Priming Prompt

I am working on a project called **"QA-Generator"**, a simple Question and Answer application designed to help me achieve specific learning and development goals. I will share a detailed project description outlining my objectives and desired features.  

We’ll work iteratively, breaking the project into clear, manageable sections. I may ask for help with brainstorming ideas, planning strategies, or writing code. After completing each section, I’ll indicate **"DONE"**, and we’ll move to the next phase.  

Please provide responses that are:  

1. **Concise and actionable** – Focused on practical next steps.  
2. **Aligned with my goals** – Tailored to the current project phase and scalable for future enhancements.  
3. **Collaborative** – Offering suggestions or asking clarifying questions where needed.  

---

## **Project Goals**  

1. Build a web-based application to simulate quizzes with question-answer data dynamically loaded from a text file.  
2. Ensure the system is accessible, robust, and extensible for future enhancements.  
3. Implement advanced features like a progress bar, randomization, and an optional timer to simulate exam-like conditions.  

---

### **Stage 0: Question Generation and Formatting** - DONE

#### **Text Document Formatting Guidelines**  

1. **General Structure**  
   - Each question begins on a new line with a number followed by a period and a space (`1.`).  
   - Include four answers labeled with letters (A, B, C, D), followed by a period and a space (`A.`).  
   - Indicate the correct answer with an asterisk (`*`) immediately after the answer text.  
   - Separate questions with one blank line.  

2. **Example Template**  

   ```
   1. What is the capital of France?  
   A. Madrid  
   B. Berlin  
   C. Paris*  
   D. Rome  

   2. Which of these is a programming language?  
   A. Python*  
   B. Snake  
   C. Cobra  
   D. Viper  
   ```  

3. **Editing Rules**  
   - Use sequential numbering (e.g., 1, 2, 3).  
   - Each question must have exactly four answers labeled A, B, C, and D.  
   - Ensure only one correct answer is marked with an asterisk.  

4. **Error Checking**  
   - Verify sequential numbering of questions.  
   - Confirm each question includes four valid answers.  
   - Ensure no formatting errors or misplaced asterisks.  

---

### Stage 1: Core Functionality - IP

1.1 **HTML Interface** - DONE

- Clean, centered container design
- Responsive layout (90% width, max 600px)
- Modern styling with shadows and rounded corners
- Mobile-friendly viewport settings

1.2 **Question Parser** - DONE

- Regular expression pattern matching
- Structured data conversion
- JSON output format
- Error handling for malformed questions

1.3 **Interactive Features**

- Dynamic question loading
- Answer selection handling
- Score tracking
- Quiz completion notification

1.4 **Core Components**

- Question display container
- Answer buttons with hover effects
- Progress tracking
- Feedback system

1.5 **Data Structure**

```javascript
{
    number: Integer,
    question: String,
    answers: [
        { 
            text: String,
            correct: Boolean 
        }
    ]
}
```

---

### **Stage 2: Basic Enhancements (Build on the Basics)**  

1. **Scoring and Feedback**  
   - Implement a scoring system to track correct and incorrect answers.  
   - Show immediate feedback (e.g., "Correct!" or "Incorrect!") after each question.  

2. **Progress Tracker**  
   - Add a "Question X of Y" indicator.  

3. **Quiz Reset**  
   - Enable a reset option to restart the quiz from the beginning.  

4. **Error Handling**  
   - Validate input file formatting and notify users of errors (e.g., missing answers or misformatted lines).  

---

### **Stage 3: User Experience and Robustness**  

1. **Dynamic Data Loading**  
   - Add a file upload feature for users to upload new question sets.  
   - Automatically parse and validate the uploaded file.  

2. **Accessibility**  
   - Ensure the application is accessible:  
     - Use ARIA roles for interactive elements.  
     - Add keyboard navigation support.  

3. **Responsive Design**  
   - Use CSS to make the app visually adaptable across devices (mobile, tablet, desktop).  

---

### **Stage 4: Advanced Features (Add Complexity)**  

1. **Progress Bar and Timer**  
   - Implement a visual progress bar showing quiz completion.  
   - Add an optional timer for exam simulation, with the ability to set time limits.  

2. **Randomization**  
   - Shuffle the order of questions and the positions of answers for every new quiz attempt.  

3. **Result Analysis**  
   - Display a summary after quiz completion, including:  
     - Total score.  
     - Correct and incorrect answers breakdown.  
     - Analysis by category (if questions are tagged).  

4. **Theme Customization**  
   - Add light/dark mode toggle to enhance user comfort.  

---

### Parsing Strategy in JavaScript  - DONE

1. **Read the File Line by Line**  
   - Use `.split("\n")` to break the text file into an array of lines.  

2. **Identify Question Lines**  
   - Match lines starting with a number and a period (`/^\d+\.\s/`).  

3. **Identify Answer Lines**  
   - Match lines starting with a letter and a period (`/^[A-D]\.\s/`).  

4. **Extract the Correct Answer**  
   - Look for an asterisk (`*`) in the answer text and remove it for storage.  

5. **Store Data in an Array**  
   - Save each question as an object:  

     ```javascript
     {
       question: "What is the capital of France?",
       answers: ["Madrid", "Berlin", "Paris", "Rome"],
       correct: 2 // Index of the correct answer
     }
     ```  
