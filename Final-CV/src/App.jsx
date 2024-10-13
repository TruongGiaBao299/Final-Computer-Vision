// Importing necessary libraries and styles
import React, { useState, useRef, useEffect } from 'react'; // React and hooks
import axios from 'axios'; // For making HTTP requests
import './App.css'; // Importing CSS styles for the app

// Define the main App component
const App = () => {
  // State variables for managing application data
  const [selectedFile, setSelectedFile] = useState(null); // Holds the file selected for upload
  const [originalImageURL, setOriginalImageURL] = useState(null); // URL for the original image
  const [processedImageURL, setProcessedImageURL] = useState(null); // URL for the processed image
  const [loading, setLoading] = useState(false); // Loading state for uploads
  const [processing, setProcessing] = useState(false); // Processing state for images
  const [progress, setProgress] = useState(0); // Progress of the upload
  const [detections, setDetections] = useState([]); // Array to hold detected objects
  const [numberOfBoxes, setNumberOfBoxes] = useState(0); // Number of detection boxes
  const [fileName, setFileName] = useState(''); // Name of the selected file
  const [detectionSummary, setDetectionSummary] = useState(''); // Summary of detected objects
  const [isCameraOpen, setIsCameraOpen] = useState(false); // State for camera open/close

  // References to DOM elements
  const videoRef = useRef(null); // Ref for the video element
  const canvasRef = useRef(null); // Ref for the canvas element
  const mediaStreamRef = useRef(null); // Ref for the media stream

  // Effect to detect objects from the camera feed
  useEffect(() => {
    let interval; // Variable to hold the interval ID
    // If the camera is open, set up detection
    if (isCameraOpen) {
      const detectObjects = async () => {
        // Ensure the video and canvas refs are available
        if (!videoRef.current || !canvasRef.current) return;

        const canvas = canvasRef.current; // Get the canvas
        const context = canvas.getContext('2d'); // Get the canvas context
        context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height); // Draw the current video frame on the canvas

        // Convert canvas content to a blob
        canvas.toBlob(async (blob) => {
          const formData = new FormData(); // Create form data to send
          formData.append('file', blob, 'captured-frame.jpg'); // Append the blob as a file

          try {
            // Send the blob to the backend for processing
            const response = await axios.post('http://localhost:5000/upload', formData, {
              responseType: 'json',
            });

            // Update detections and number of boxes based on response
            setDetections(response.data.detections);
            setNumberOfBoxes(response.data.number_of_boxes);

            // Count detected classes
            const classCount = {};
            response.data.detections.forEach((detection) => {
              const className = detection.className; // Get class name
              classCount[className] = (classCount[className] || 0) + 1; // Increment count
            });

            // Create a summary of detections
            const summary = Object.entries(classCount)
              .map(([className, count]) => `${count} ${className}${count > 1 ? 's' : ''}`) // Format summary
              .join(', '); // Join with commas

            setDetectionSummary(`This frame contains: ${summary}`); // Set the summary in state
          } catch (error) {
            console.error('Error detecting objects from camera:', error); // Log any errors
          }
        });
      };

      // Set an interval to call detectObjects every second
      interval = setInterval(detectObjects, 1000);
    }

    // Clean up the interval on unmount or when isCameraOpen changes
    return () => {
      clearInterval(interval);
    };
  }, [isCameraOpen]); // Dependency array includes isCameraOpen

  // Function to open the camera
  const handleOpenCamera = async () => {
    setIsCameraOpen(true); // Set camera state to open
    mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ video: true }); // Get the media stream
    videoRef.current.srcObject = mediaStreamRef.current; // Set the video source to the media stream
  };

  // Function to close the camera
  const handleCloseCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop()); // Stop all media tracks
    }
    setIsCameraOpen(false); // Set camera state to closed
    clearDetectionItems(); // Clear detection items

    // Refresh the page
    window.location.reload(); // Reload the page
  };

  // Function to handle file input change
  const handleFileChange = (event) => {
    const file = event.target.files[0]; // Get the selected file
    setSelectedFile(file); // Update selected file state
    setOriginalImageURL(file ? URL.createObjectURL(file) : null); // Create URL for the original image
    setProcessedImageURL(null); // Reset processed image URL
    setFileName(file ? file.name : ''); // Update file name state
    clearDetectionItems(); // Clear previous detections
  };

  // Function to handle file upload
  const handleUpload = async () => {
    if (!selectedFile) return; // Return if no file is selected

    setProcessing(true); // Set processing state to true
    setLoading(true); // Set loading state to true
    setProgress(0); // Reset progress to 0

    try {
      const formData = new FormData(); // Create form data
      formData.append('file', selectedFile); // Append selected file to form data

      // Create an Axios instance with a base URL and timeout
      const instance = axios.create({
        baseURL: 'http://localhost:5000',
        timeout: 10000,
      });

      // Send the file to the backend for processing
      const response = await instance.post('/upload', formData, {
        responseType: 'json',
        onUploadProgress: (event) => {
          if (event.total) {
            setProgress(Math.round((event.loaded * 100) / event.total)); // Calculate upload progress
          }
        },
      });

      // Create URL for the processed image
      const processedImageUrl = `http://localhost:5000/static/${response.data.image}?t=${new Date().getTime()}`;
      setProcessedImageURL(processedImageUrl); // Update processed image URL
      setOriginalImageURL(URL.createObjectURL(selectedFile)); // Set original image URL
      setDetections(response.data.detections); // Set detections from response
      setNumberOfBoxes(response.data.number_of_boxes); // Set number of boxes

      // Count detected classes
      const classCount = {};
      response.data.detections.forEach((detection) => {
        const className = detection.className; // Get class name
        classCount[className] = (classCount[className] || 0) + 1; // Increment count
      });

      // Create a summary of detections
      const summary = Object.entries(classCount)
        .map(([className, count]) => `${count} ${className}${count > 1 ? 's' : ''}`) // Format summary
        .join(', '); // Join with commas

      setDetectionSummary(`This image contains: ${summary}`); // Set the summary in state
    } catch (error) {
      console.error('Error uploading file:', error); // Log any errors
    } finally {
      setProcessing(false); // Reset processing state
      setLoading(false); // Reset loading state
    }
  };

  // Function to clear detection items
  const clearDetectionItems = () => {
    setDetections([]); // Clear detections
    setNumberOfBoxes(0); // Reset number of boxes
    setDetectionSummary(''); // Clear detection summary
  };

  // Function to clear the displayed images
  const handleClearImage = () => {
    setOriginalImageURL(null); // Clear original image URL
    setProcessedImageURL(null); // Clear processed image URL
    setSelectedFile(null); // Reset selected file
    clearDetectionItems(); // Clear detections
  };

  // Render the component
  return (
    <div className="App">
      <h1>Upload and Process Image or Use Camera</h1>
      <div className="file-input-container" onClick={() => document.getElementById('file-input').click()}>
        {/* Hidden file input that opens on click */}
        <input
          id="file-input"
          type="file"
          onChange={handleFileChange} // Handle file change
          style={{ display: 'none' }} // Hide the input
        />
        <span className="file-input-text">
          {fileName ? fileName : 'Load your file here'} {/* Display file name or placeholder */}
        </span>
      </div>
      <br />
      <div className="image-button">
        <button onClick={handleUpload} disabled={loading || processing} className="upload-button">
          {processing ? 'Processing...' : 'Process Image'} {/* Change button text based on state */}
        </button>
        <button onClick={handleClearImage} className="clear-button">
          Clear Image {/* Button to clear images */}
        </button>
        <button onClick={handleOpenCamera} className="camera-button">
          Open Camera {/* Button to open camera */}
        </button>
        {isCameraOpen && (
          <button onClick={handleCloseCamera} className="close-camera-button">
            Close Camera {/* Button to close camera */}
          </button>
        )}
      </div>

      <div className="content-container">
        {isCameraOpen && (
          <div className="camera-container">
            <video ref={videoRef} autoPlay className="camera-feed"></video> {/* Video element for camera feed */}
            <canvas ref={canvasRef} width="640" height="480" style={{ display: 'none' }}></canvas> {/* Hidden canvas for capturing frames */}
          </div>
        )}
        
        {!isCameraOpen && (
          <div className="image-comparison-container">
            {originalImageURL && (
              <div className="image-wrapper">
                <h2>Original Image</h2>
                <img src={originalImageURL} alt="Original" className="original-image" /> {/* Display original image */}
              </div>
            )}
            {processedImageURL && (
              <div className="image-wrapper">
                <h2>Processed Image</h2>
                <img src={processedImageURL} alt="Processed" className="processed-image" /> {/* Display processed image */}
              </div>
            )}
          </div>
        )}

        <div className="detections">
          {detectionSummary && <p className='detection-summary'>{detectionSummary}</p>} {/* Show detection summary */}
          {numberOfBoxes >= 2 ? (
            <div className="grid-container">
              {detections.map((detection, index) => (
                <div className="grid-item" key={index}>
                  {/* Display each detection with box coordinates, confidence, and class */}
                  <strong>Box:</strong> ({detection.x1.toFixed(2)}, {detection.y1.toFixed(2)}) - ({detection.x2.toFixed(2)}, {detection.y2.toFixed(2)})
                  <br />
                  <strong>Confidence:</strong> {detection.confidence.toFixed(2)}
                  <br />
                  <strong>Class:</strong> {detection.className}
                </div>
              ))}
            </div>
          ) : (
            <ul>
              {detections.map((detection, index) => (
                <li key={index}>
                  {/* Display each detection in a list format */}
                  <strong>Box:</strong> ({detection.x1.toFixed(2)}, {detection.y1.toFixed(2)}) - ({detection.x2.toFixed(2)}, {detection.y2.toFixed(2)})
                  <br />
                  <strong>Confidence:</strong> {detection.confidence.toFixed(2)}
                  <br />
                  <strong>Class:</strong> {detection.className}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Show upload progress if loading */}
      {loading && <div className="progress-container"><div className="progress-bar" style={{ width: `${progress}%` }}>{progress}%</div></div>}
    </div>
  );
};

// Export the App component for use in other files
export default App;
