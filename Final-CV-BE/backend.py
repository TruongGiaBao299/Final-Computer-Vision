# Import necessary libraries
from flask import Flask, request, jsonify, send_from_directory, Response  # Flask for building the web app and handling requests
from flask_cors import CORS  # CORS for handling cross-origin requests
from ultralytics import YOLO  # YOLO for object detection
import os  # OS module for file and directory operations
import cv2  # OpenCV for image processing
import numpy as np  # NumPy for numerical operations
import time  # Import time module to measure processing time

# Initialize the Flask application
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes in the app

# Load the pre-trained YOLOv8 model
model = YOLO('yolov8n.pt')

# Set the directory to store uploaded and processed images
UPLOAD_FOLDER = 'static'  # Directory name for storing images
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER  # Configure Flask to use this directory

# Global variable to control the camera stream state
camera_open = False  # Flag to indicate if the camera is open or closed

# Endpoint to serve static files (processed images)
@app.route('/static/<path:filename>')
def serve_static_file(filename):
    # Serve the requested file from the UPLOAD_FOLDER
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

# Endpoint to upload and process images
@app.route('/upload', methods=['POST'])
def upload_file():
    # Start the timer for processing
    start_time = time.time()

    # Get the uploaded file from the request
    file = request.files['file']  

    # Save the uploaded image to the specified folder
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], file.filename)  # Create a file path
    file.save(filepath)  # Save the file to disk

    # Load the saved image using OpenCV
    image = cv2.imread(filepath)

    # Perform object detection on the loaded image using YOLO
    results = model.predict(image)

    # Draw bounding boxes and save the annotated image
    annotated_image = results[0].plot()  # Annotate the image with detected boxes
    processed_image_path = os.path.join(app.config['UPLOAD_FOLDER'], 'processed_' + file.filename)  # Define the path for processed image
    cv2.imwrite(processed_image_path, annotated_image)  # Save the annotated image

    # Extract detection results
    detections = []  # List to hold detected objects
    for box in results[0].boxes.data.tolist():  # Loop through detected boxes
        x1, y1, x2, y2, confidence, class_id = box  # Unpack box data
        detections.append({
            'x1': x1, 'y1': y1, 'x2': x2, 'y2': y2,  # Box coordinates
            'confidence': confidence,  # Detection confidence
            'className': model.names[int(class_id)]  # Class name from model
        })

    # Calculate and print processing time
    processing_time = time.time() - start_time
    print(f"Image processing time: {processing_time:.2f} seconds")

    # Return JSON response with processed image information and detections
    return jsonify({
        'image': 'processed_' + file.filename,  # Filename of the processed image
        'number_of_boxes': len(detections),  # Number of detected boxes
        'detections': detections  # List of detection results
    })

# Video streaming generator function for camera feed
def generate_camera_feed():
    cap = cv2.VideoCapture(0)  # Open the default camera (index 0)
    
    # Continuously read frames while the camera is open
    while camera_open:
        success, frame = cap.read()  # Read a frame from the camera
        if not success:  # If frame read was unsuccessful, break the loop
            break

        # Start the timer for processing each frame
        start_time = time.time()

        # Perform object detection on the current frame
        results = model.predict(frame)
        
        # Annotate the frame with detected objects
        annotated_frame = results[0].plot()

        # Encode the annotated frame as JPEG
        ret, buffer = cv2.imencode('.jpg', annotated_frame)  # Encode to JPEG format
        frame = buffer.tobytes()  # Convert to byte format

        # Calculate and print processing time for each frame
        processing_time = time.time() - start_time
        print(f"Frame processing time: {processing_time:.2f} seconds")

        # Yield the frame for streaming in byte format
        yield (b'--frame\r\n'  # Start boundary for frame
               b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')  # Specify content type and send frame

    cap.release()  # Release the camera resource when done

# Endpoint to start the camera and serve real-time object detection feed
@app.route('/video_feed')
def video_feed():
    global camera_open  # Access global variable for camera state
    camera_open = True  # Set camera state to open
    return Response(generate_camera_feed(), mimetype='multipart/x-mixed-replace; boundary=frame')  # Stream the camera feed

# Endpoint to stop the camera feed
@app.route('/stop_camera', methods=['POST'])
def stop_camera():
    global camera_open  # Access global variable for camera state
    camera_open = False  # Set camera state to closed
    return jsonify({'status': 'Camera stopped'})  # Return a JSON response indicating the camera has stopped

# Main block to run the Flask app
if __name__ == '__main__':
    if not os.path.exists(UPLOAD_FOLDER):  # Check if the upload folder exists
        os.makedirs(UPLOAD_FOLDER)  # Create the directory if it does not exist
    app.run(debug=True)  # Run the Flask app in debug mode
