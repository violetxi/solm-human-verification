import React, { useState, useEffect } from 'react';
import './App.css';
import Papa from 'papaparse';
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, updateDoc, arrayUnion } from "firebase/firestore";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDQmN4O5MNG0zqiy9lbOaSUx1XeGxr9ZnY",
  authDomain: "solm-human-verificatoin.firebaseapp.com",
  projectId: "solm-human-verificatoin",
  storageBucket: "solm-human-verificatoin.firebasestorage.app",
  messagingSenderId: "333316730417",
  appId: "1:333316730417:web:95e7135950c18e3ef6af10"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function App() {
  const [stage, setStage] = useState('prolific');
  const [studyData, setStudyData] = useState(null);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [responses, setResponses] = useState([]);
  const [prolificId, setProlificId] = useState('');
  const [answeredItems, setAnsweredItems] = useState(new Set());
  const [availableItems, setAvailableItems] = useState([]);

  // Load CSV data
  useEffect(() => {
    const loadData = async () => {
      try {
        // Add timestamp to URL to prevent caching
        const timestamp = new Date().getTime();
        const response = await fetch(`/data/verification_exp.csv?t=${timestamp}`);
        const csvText = await response.text();
        
        // Log raw CSV text
        console.log("Raw CSV first 100 chars:", csvText.substring(0, 100));
        
        const results = Papa.parse(csvText, { header: true });
        
        // Verify parsed data
        if (!results.data || results.data.length === 0) {
          console.error("No data parsed from CSV");
          return;
        }
        
        // Create array of indices for randomization
        const shuffledIndices = [...Array(results.data.length).keys()];
        for (let i = shuffledIndices.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffledIndices[i], shuffledIndices[j]] = [shuffledIndices[j], shuffledIndices[i]];
        }
        console.log("Initial shuffled indices:", shuffledIndices); // Debug log
        
        setAvailableItems(shuffledIndices);
        setStudyData(results.data);
      } catch (error) {
        console.error("Error loading CSV:", error);
      }
    };
    loadData();
  }, []);

  // Firebase functions
  const initializeParticipant = async (id) => {
    try {
      console.log("Initializing participant:", id);
      await setDoc(doc(db, "participants", id), {
        prolificId: id,
        startTime: new Date().toISOString(),
        responses: []
      });
      console.log("Successfully initialized participant");
      return true;
    } catch (error) {
      console.error("Error initializing participant:", error);
      return false;
    }
  };

  const saveResponse = async (response) => {
    try {
      // Add timestamp to metadata
      const timestamp = new Date().getTime();
      const participantRef = doc(db, "participants", prolificId);
      
      await updateDoc(participantRef, {
        responses: arrayUnion({
          ...response,
          _timestamp: timestamp, // Add timestamp to force update
          timestamp: new Date().toISOString()
        })
      });
      return true;
    } catch (error) {
      console.error("Error saving response:", error);
      return false;
    }
  };

  // Prolific ID Collection Component
  const ProlificIdForm = ({ onSubmit }) => {
    const [id, setId] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!id.trim()) {
        setError('Please enter your Prolific ID');
        return;
      }
      const success = await initializeParticipant(id);
      if (success) {
        onSubmit(id);
      } else {
        setError('There was an error initializing your session. Please try again.');
      }
    };

    return (
      <div className="prolific-id-form">
        <h2>Welcome to the Study</h2>
        <p>Please enter your Prolific ID to begin:</p>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="Enter your Prolific ID"
          />
          {error && <div className="error">{error}</div>}
          <button type="submit">Continue</button>
        </form>
      </div>
    );
  };

  // Get random conversation
  const getRandomConversation = () => {
    if (!studyData || availableItems.length === 0) return null;
    const nextIndex = availableItems[0]; // Get first item from shuffled array
    console.log("Getting conversation with index:", nextIndex); // Debug log
    return studyData[nextIndex];
  };

  // Introduction component
  const Introduction = ({ onNext }) => (
    <div className="introduction">
      <h1>Conversation Analysis Study</h1>
      <p>Welcome to our research study! In this task, you will:</p>
      <ul>
        <li>Read conversations between two people discussing various topics</li>
        <li>For each conversation, you will see a specific statement that was made during the conversation</li>
        <li>You will evaluate three aspects using 5-point scales:
          <ol>
            <li>How well the label matches the statement in the context of the conversation</li>
            <li>Whether there is redundant content in the conversation</li>
            <li>How natural the conversation flow feels</li>
          </ol>
        </li>
      </ul>
      <div className="warning-message">
        <p><strong>Important Note:</strong> We expect a quick turnaround for this study. If you accept this study, please start and complete it immediately. If you cannot complete the study right away, please return it so others can participate. Delayed starts may result in a request to return the study.</p>
        <p><strong>Important Note:</strong> Do not refresh the page or close the window. This will interrupt your participation and we will not be able to record your responses.</p>
      </div>
      <button onClick={onNext}>Continue to Comprehension Check</button>
    </div>
  );

  // Comprehension Quiz component
  const ComprehensionQuiz = ({ onPass }) => {
    const [answers, setAnswers] = useState({});
    const [showWarning, setShowWarning] = useState(false);

    const questions = [
      {
        id: 1,
        question: "You will be evaluating conversations using 5-point Likert scales.",
        correct: true
      },
      {
        id: 2,
        question: "You need to assess if there is redundant content in the conversation.",
        correct: true
      },
      {
        id: 3,
        question: "You don't need to evaluate the naturalness of conversations.",
        correct: false
      }
    ];

    const handleSubmit = () => {
      const allCorrect = questions.every(q => answers[q.id] === q.correct);
      if (allCorrect) {
        onPass();
      } else {
        setShowWarning(true);
      }
    };

    return (
      <div className="comprehension-quiz">
        <h2>Comprehension Check</h2>
        {questions.map(q => (
          <div key={q.id} className="quiz-question">
            <p>{q.question}</p>
            <div className="quiz-options">
              <label>
                <input
                  type="radio"
                  name={`q${q.id}`}
                  value="true"
                  onChange={() => setAnswers({...answers, [q.id]: true})}
                /> True
              </label>
              <label>
                <input
                  type="radio"
                  name={`q${q.id}`}
                  value="false"
                  onChange={() => setAnswers({...answers, [q.id]: false})}
                /> False
              </label>
            </div>
          </div>
        ))}
        {showWarning && (
          <div className="warning">
            Please review the introduction and try again. All answers must be correct to proceed.
          </div>
        )}
        <button onClick={handleSubmit}>Submit</button>
      </div>
    );
  };

  // Study Task component
  const StudyTask = ({ conversation, onSubmit }) => {
    const [ratings, setRatings] = useState({
      labelAlignment: null,
      redundantContent: null,
      naturalFlow: null
    });

    const likertOptions = [
      "Strongly Disagree",
      "Disagree",
      "Neutral",
      "Agree",
      "Strongly Agree"
    ];

    const handleSubmit = () => {
      if (Object.values(ratings).some(r => r === null)) {
        alert("Please complete all ratings before submitting.");
        return;
      }
      onSubmit(ratings);
    };

    return (
      <div className="study-task">
        <h2>Conversation Analysis</h2>
        
        <div className="conversation">
          <h3>Conversation:</h3>
          <pre>{conversation.conversation}</pre>
        </div>

        <div className="statement-section">
          <h3>Statement and Label:</h3>
          <div className="statement-box">
            <p><strong>Statement:</strong> {conversation.original_data}</p>
            <p className="label"><strong>Label:</strong> {conversation.original_label}</p>
          </div>
        </div>

        <div className="ratings">
          <div className="rating-item">
            <p>The label aligns with the statement in the context of the conversation:</p>
            <div className="likert-scale">
              {likertOptions.map((option, i) => (
                <label key={i}>
                  <input
                    type="radio"
                    name="labelAlignment"
                    value={i + 1}
                    onChange={(e) => setRatings({...ratings, labelAlignment: parseInt(e.target.value)})}
                  />
                  {option}
                </label>
              ))}
            </div>
          </div>

          <div className="rating-item">
            <p>There is no redundant content in the conversation:</p>
            <div className="likert-scale">
              {likertOptions.map((option, i) => (
                <label key={i}>
                  <input
                    type="radio"
                    name="redundantContent"
                    value={i + 1}
                    onChange={(e) => setRatings({...ratings, redundantContent: parseInt(e.target.value)})}
                  />
                  {option}
                </label>
              ))}
            </div>
          </div>

          <div className="rating-item">
            <p>The flow of the conversation is natural:</p>
            <div className="likert-scale">
              {likertOptions.map((option, i) => (
                <label key={i}>
                  <input
                    type="radio"
                    name="naturalFlow"
                    value={i + 1}
                    onChange={(e) => setRatings({...ratings, naturalFlow: parseInt(e.target.value)})}
                  />
                  {option}
                </label>
              ))}
            </div>
          </div>
        </div>

        <button onClick={handleSubmit}>Submit Ratings</button>
      </div>
    );
  };

  const handleTaskSubmit = async (ratings) => {
    // First, verify we have all the data
    if (!currentConversation) {
      console.error("No current conversation data");
      return;
    }

    // Log the entire currentConversation object
    console.log("Full conversation object:", JSON.stringify(currentConversation));

    // Explicitly construct the response with all fields
    const response = {
      original_statement: currentConversation.original_data || '',
      original_label: currentConversation.original_label || '',
      pass_verification: currentConversation.pass_verification ? Number(currentConversation.pass_verification) : 0,
      labelAlignment: ratings.labelAlignment,
      redundantContent: ratings.redundantContent,
      naturalFlow: ratings.naturalFlow,
      timestamp: new Date().toISOString()
    };

    // Log the constructed response
    console.log("Saving response:", JSON.stringify(response));

    const success = await saveResponse(response);
    if (success) {
      const newAvailable = availableItems.slice(1);
      setAvailableItems(newAvailable);
      setResponses([...responses, response]);
      
      if (newAvailable.length === 0) {
        setStage('completed');
      } else {
        const nextConversation = studyData[newAvailable[0]];
        if (!nextConversation) {
          console.error("Failed to get next conversation");
          return;
        }
        setCurrentConversation(nextConversation);
      }
    } else {
      alert('There was an error saving your response. Please try again.');
    }
  };

  const startTask = () => {
    const firstConversation = getRandomConversation();
    setCurrentConversation(firstConversation);
    setStage('task');
  };

  // Completion Page component
  const CompletionPage = () => (
    <div className="completion-page">
      <h2>Study Completed!</h2>
      <p>Thank you for participating in our research study.</p>
      <p>You may now close this window and return to Prolific to complete your submission.</p>
      <div className="completion-note">
        <p>Your responses have been successfully recorded.</p>
        <p>Please click the "Complete" button on Prolific to finalize your participation.</p>
      </div>
    </div>
  );

  // Render current stage
  const renderStage = () => {
    if (stage === 'prolific') {
      return <ProlificIdForm onSubmit={(id) => {
        setProlificId(id);
        setStage('intro');
      }} />;
    }

    switch (stage) {
      case 'intro':
        return <Introduction onNext={() => setStage('quiz')} />;
      case 'quiz':
        return <ComprehensionQuiz onPass={startTask} />;
      case 'task':
        return currentConversation ? (
          <StudyTask 
            conversation={currentConversation}
            onSubmit={handleTaskSubmit}
          />
        ) : (
          <div>Loading...</div>
        );
      case 'completed':
        return <CompletionPage />;
      default:
        return <div>Loading...</div>;
    }
  };

  return (
    <div className="App">
      {renderStage()}
    </div>
  );
}

export default App;
