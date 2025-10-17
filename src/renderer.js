// This file is the "renderer process" script for your index.html page.
// It's responsible for all the logic that controls the user interface.

// --- 1. Get references to our HTML elements ---
// We need to be able to talk to the buttons and video elements from our HTML.
// document.getElementById finds an element by its 'id' attribute.
const startBtn = document.getElementById('start-btn');
const localVideo = document.getElementById('local-video');

// This will hold the video and audio stream from our webcam.
let localStream;

// --- 2. Create the main function to access the camera ---
// We use an 'async' function because getting media is an asynchronous operation.
const startCamera = async () => {
  try {
    // navigator.mediaDevices.getUserMedia() is the core WebRTC function.
    // It prompts the user for permission to access their media devices.
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true, // We want to get video.
      audio: true  // We also want to get audio (for later).
    });

    // If the user gives permission, the 'stream' variable will hold their camera feed.
    console.log('Successfully accessed camera and microphone.');
    
    // Store the stream in our global variable so we can use it later (e.g., to hang up).
    localStream = stream;

    // Connect the stream to our HTML video element.
    // The <video> element will now display what the camera sees.
    localVideo.srcObject = stream;

  } catch (error) {
    // If the user denies permission, or if there's no camera, an error will be thrown.
    console.error('Error accessing media devices:', error);
    alert('Could not access your camera. Please make sure it is not being used by another application and that you have granted permission.');
  }
};


// --- 3. Add the event listener to the button ---
// This line connects our 'startCamera' function to the "Start Camera" button.
// When the button is clicked, the startCamera function will be executed.
startBtn.addEventListener('click', startCamera);