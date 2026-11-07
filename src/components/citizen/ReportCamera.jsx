import React, {
  useEffect,
  useRef,
  useState,
} from 'react';
import { motion } from 'framer-motion';
import Confetti from 'react-confetti';
import {
  Camera,
  MapPin,
  ArrowLeft,
  RotateCcw,
  CheckCircle2,
  Send,
} from 'lucide-react';
import { apiFetch } from '../../api/client';
import { motionTiming, successVariants } from '../../ui/motion';
const ReportCamera = ({
  reportType,
  onBack,
}) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [location, setLocation] = useState(null);
  const [locationLoading, setLocationLoading] =
    useState(true);
  const [locationError, setLocationError] =
    useState('');
  const [cameraActive, setCameraActive] =
    useState(false);
  const [cameraError, setCameraError] =
    useState('');
  const [photo, setPhoto] = useState(null);
  const [isAnalyzing, setIsAnalyzing] =
    useState(false);
  const [prediction, setPrediction] =
    useState(null);
  const [confidence, setConfidence] =
    useState(null);
  const [mlError, setMlError] =
    useState('');
  const [description, setDescription] =
    useState('');
  const [isSubmitting, setIsSubmitting] =
    useState(false);
  const [submitError, setSubmitError] =
    useState('');
  const [complaintResult, setComplaintResult] =
    useState(null);
  const [showConfetti, setShowConfetti] =
    useState(false);
  const title =
    reportType === 'road'
      ? 'Report Road Issue'
      : 'Report Garbage';
  const expectedClass =
    reportType === 'road'
      ? 'ROAD_DAMAGED'
      : 'GARBAGE';
  const endpoint =
    reportType === 'road'
      ? '/citizen/complaints/road'
      : '/citizen/complaints/garbage';
  /* ========================================================
     LOCATION
     ======================================================== */
  const getLocation = () => {
    setLocationLoading(true);
    setLocationError('');
    if (!navigator.geolocation) {
      setLocationError(
        'Geolocation is not supported by this browser.'
      );
      setLocationLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocationLoading(false);
      },
      (error) => {
        console.error(
          'Location error:',
          error
        );
        setLocationError(
          'Location permission is required to continue.'
        );
        setLocationLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };
  /* ========================================================
     CAMERA
     ======================================================== */
  const startCamera = async () => {
    try {
      setCameraError('');
      if (
        !navigator.mediaDevices?.getUserMedia
      ) {
        throw new Error(
          'Camera is not supported.'
        );
      }
      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: {
            width: {
              ideal: 1280,
            },
            height: {
              ideal: 720,
            },
          },
          audio: false,
        });
      streamRef.current = stream;
      const track =
        stream.getVideoTracks()[0];
      /*
       * Request 1× zoom where supported.
       */
      if (track) {
        const capabilities =
          track.getCapabilities?.();
        if (
          capabilities?.zoom &&
          capabilities.zoom.min <= 1 &&
          capabilities.zoom.max >= 1
        ) {
          try {
            await track.applyConstraints({
              advanced: [{ zoom: 1 }],
            });
          } catch (zoomError) {
            console.warn(
              'Could not apply 1× zoom:',
              zoomError
            );
          }
        }
      }
      setCameraActive(true);
    } catch (error) {
      console.error(
        'Camera error:',
        error
      );
      setCameraError(
        'Unable to access camera. Please allow camera permission.'
      );
      setCameraActive(false);
    }
  };
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current
        .getTracks()
        .forEach((track) => {
          track.stop();
        });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };
  /*
   * Attach stream after <video> is mounted.
   */
  useEffect(() => {
    if (
      cameraActive &&
      videoRef.current &&
      streamRef.current
    ) {
      const video = videoRef.current;
      const stream = streamRef.current;
      video.srcObject = stream;
      const playVideo = async () => {
        try {
          await video.play();
        } catch (error) {
          console.error(
            'Video play error:',
            error
          );
        }
      };
      if (video.readyState >= 1) {
        playVideo();
      } else {
        video.onloadedmetadata =
          playVideo;
      }
    }
  }, [cameraActive]);
  /* ========================================================
     ML CLASSIFICATION
     ======================================================== */
  const classifyPhoto = async (blob) => {
    setIsAnalyzing(true);
    setMlError('');
    setPrediction(null);
    setConfidence(null);
    try {
      const formData = new FormData();
      formData.append(
        'file',
        blob,
        'complaint.jpg'
      );
      const data = await apiFetch(
        '/ml/classify',
        {
          method: 'POST',
          body: formData,
        }
      );
      setPrediction(data.prediction);
      setConfidence(data.confidence);
    } catch (error) {
      console.error(
        'Classification error:',
        error
      );
      setMlError(
        error.status === 401
          ? 'Your session has expired. Please sign in again.'
          : error.message ||
            'Unable to analyze the image.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };
  /* ========================================================
     CAPTURE
     ======================================================== */
  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) {
      return;
    }
    if (
      video.readyState < 2 ||
      video.videoWidth === 0 ||
      video.videoHeight === 0
    ) {
      console.warn(
        'Video is not ready for capture.'
      );
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context =
      canvas.getContext('2d');
    if (!context) {
      return;
    }
    context.drawImage(
      video,
      0,
      0,
      video.videoWidth,
      video.videoHeight
    );
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          return;
        }
        const url =
          URL.createObjectURL(blob);
        setPhoto({
          blob,
          url,
        });
        stopCamera();
        await classifyPhoto(blob);
      },
      'image/jpeg',
      0.9
    );
  };
  /* ========================================================
     RETAKE
     ======================================================== */
  const retakePhoto = () => {
    if (photo?.url) {
      URL.revokeObjectURL(photo.url);
    }
    setPhoto(null);
    setPrediction(null);
    setConfidence(null);
    setMlError('');
    setDescription('');
    setSubmitError('');
    setComplaintResult(null);
    setShowConfetti(false);
    startCamera();
  };
  /* ========================================================
     SUBMIT COMPLAINT
     ======================================================== */
  const submitComplaint = async () => {
    if (!photo?.blob) {
      return;
    }
    if (!location) {
      setSubmitError(
        'Location is required.'
      );
      return;
    }
    if (prediction !== expectedClass) {
      setSubmitError(
        'This image does not match the selected complaint type.'
      );
      return;
    }
    setIsSubmitting(true);
    setSubmitError('');
    setComplaintResult(null);
    setShowConfetti(false);
    try {
      const formData = new FormData();
      formData.append(
        'title',
        title
      );
      formData.append(
        'description',
        description.trim()
      );
      formData.append(
        'latitude',
        String(location.latitude)
      );
      formData.append(
        'longitude',
        String(location.longitude)
      );
      formData.append(
        'file',
        photo.blob,
        'complaint.jpg'
      );
      const data = await apiFetch(
        endpoint,
        {
          method: 'POST',
          body: formData,
        }
      );
      setComplaintResult(data);
      setShowConfetti(true);
    } catch (error) {
      console.error(
        'Complaint submission error:',
        error
      );
      setSubmitError(
        error.status === 401
          ? 'Your session has expired. Please sign in again.'
          : error.message ||
            'Unable to create complaint.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };
  /* ========================================================
     BACK
     ======================================================== */
  const handleBack = () => {
    stopCamera();
    if (photo?.url) {
      URL.revokeObjectURL(photo.url);
    }
    onBack();
  };
  /* ========================================================
     CLEANUP
     ======================================================== */
  useEffect(() => {
    getLocation();
    return () => {
      if (streamRef.current) {
        streamRef.current
          .getTracks()
          .forEach((track) => {
            track.stop();
          });
      }
      if (photo?.url) {
        URL.revokeObjectURL(photo.url);
      }
    };
  }, []);
  /* ========================================================
     RESULT
     ======================================================== */
  const isAccepted =
    prediction === expectedClass;
  /* ========================================================
     UI
     ======================================================== */
  return (
    <div className="civic-dashboard">
      <div
        className="report-camera-container"
      >
        {/* BACK */}
        <button
          type="button"
          onClick={handleBack}
          className="report-camera-back"
        >
          <ArrowLeft size={17} />
          Back
        </button>
        {/* HEADER */}
        <h1
          className="report-camera-heading"
        >
          {title}
        </h1>
        <p
          className="report-camera-subtitle"
        >
          Capture and verify the civic issue.
        </p>
        {/* ==================================================
            LOCATION
            ================================================== */}
        <div
          className="civic-panel report-camera-section report-camera-location-section"
          
        >
          <div
            className="report-camera-location-row"
          >
            <div
              className="report-camera-location-icon"
            >
              <MapPin size={21} />
            </div>
            <div>
              <strong
                className="report-camera-location-title"
              >
                {locationLoading
                  ? 'Getting your location...'
                  : location
                  ? 'Location captured'
                  : 'Location unavailable'}
              </strong>
              {location && (
                <span
                  className="report-camera-location-coordinates"
                >
                  {location.latitude.toFixed(6)},{' '}
                  {location.longitude.toFixed(6)}
                </span>
              )}
            </div>
          </div>
          {locationError && (
            <div
              className="report-camera-error"
            >
              {locationError}
            </div>
          )}
          {!location &&
            !locationLoading && (
              <button
                type="button"
                onClick={getLocation}
                className="report-camera-retry"
              >
                Try Location Again
              </button>
            )}
        </div>
        {/* ==================================================
            CAMERA
            ================================================== */}
        {!photo && location && (
          <div
            className="civic-panel report-camera-section"
            
          >
            {!cameraActive ? (
              <div
                className="report-camera-camera-intro"
              >
                <Camera
                  size={42}
                  className="report-camera-camera-icon"
                />
                <h3
                  className="report-camera-camera-title"
                >
                  Take a live photo
                </h3>
                <p
                  className="report-camera-camera-copy"
                >
                  Use your camera to capture
                  the civic issue. Gallery
                  uploads are not allowed.
                </p>
                {cameraError && (
                  <div
                    className="report-camera-error"
                  >
                    {cameraError}
                  </div>
                )}
                <button
                  type="button"
                  onClick={startCamera}
                  className="report-camera-camera-button"
                >
                  <Camera size={18} />
                  Open Camera
                </button>
              </div>
            ) : (
              <>
                <div
                  className="report-camera-viewport"
                >
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="report-camera-video"
                  />
                  <span
                    className="report-camera-zoom"
                  >
                    1×
                  </span>
                </div>
                <button
                  type="button"
                  onClick={capturePhoto}
                  className="report-camera-capture-button"
                >
                  <Camera size={19} />
                  Capture Photo
                </button>
              </>
            )}
          </div>
        )}
        {/* ==================================================
            PHOTO + ML
            ================================================== */}
        {photo && (
          <div
            className="civic-panel report-camera-section"
            
          >
            <p className="civic-eyebrow">
              PHOTO ANALYSIS
            </p>
            <h3
              className="report-camera-photo-title"
            >
              Check your photo
            </h3>
            <img
              src={photo.url}
              alt="Captured civic issue"
              className="report-camera-photo"
            />
            {/* ANALYZING */}
            {isAnalyzing && (
              <div
                className="report-camera-analysis"
              >
                Analyzing image with AI...
              </div>
            )}
            {/* ML ERROR */}
            {mlError &&
              !isAnalyzing && (
                <div
                  className="report-camera-error"
                >
                  {mlError}
                </div>
              )}
            {/* ML RESULT */}
            {prediction &&
              !isAnalyzing &&
              !mlError && (
                <div
                  className="report-camera-result"
                >
                  <div
                    className="report-camera-result-label"
                  >
                    AI DETECTION
                  </div>
                  <div
                    className={`report-camera-result-prediction ${isAccepted ? 'is-accepted' : 'is-rejected'}`}
                  >
                    {prediction}
                  </div>
                  {confidence !==
                    null && (
                    <div
                      className="report-camera-result-confidence"
                    >
                      Confidence:{' '}
                      {(
                        confidence *
                        100
                      ).toFixed(2)}
                      %
                    </div>
                  )}
                  <div
                    className={`report-camera-result-message ${isAccepted ? 'is-accepted' : 'is-rejected'}`}
                  >
                    {isAccepted && (
                      <CheckCircle2
                        size={17}
                      />
                    )}
                    {isAccepted
                      ? 'Valid report. You can submit this complaint.'
                      : `This image does not match the selected ${reportType} issue.`}
                  </div>
                </div>
              )}
            {/* ==================================================
                SUBMISSION
                ================================================== */}
            {isAccepted &&
              !isAnalyzing &&
              !mlError &&
              !complaintResult && (
                <div
                  className="report-camera-submission"
                >
                  <p className="civic-eyebrow">
                    COMPLAINT DETAILS
                  </p>
                  <label
                    className="report-camera-label"
                  >
                    Description
                    <span
                      className="report-camera-optional"
                    >
                      {' '}
                      (optional)
                    </span>
                  </label>
                  <textarea
                    value={
                      description
                    }
                    onChange={(e) =>
                      setDescription(
                        e.target.value
                      )
                    }
                    placeholder="Add any useful details about the issue..."
                    rows={4}
                    className="report-camera-textarea"
                  />
                  {submitError && (
                    <div
                      className="report-camera-error"
                    >
                      {submitError}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={
                      submitComplaint
                    }
                    disabled={
                      isSubmitting
                    }
                    className={`report-camera-submit ${isSubmitting ? 'is-loading' : ''}`}
                  >
                    <Send size={17} />
                    {isSubmitting
                      ? 'Submitting...'
                      : 'Submit Complaint'}
                  </button>
                </div>
              )}
            {/* ==================================================
                SUCCESS
                ================================================== */}
            {complaintResult && (
              <>
                {showConfetti && (
                  <Confetti
                    recycle={false}
                    numberOfPieces={220}
                    gravity={0.18}
                  />
                )}
                <motion.div
                  className="report-camera-success"
                  variants={successVariants}
                  initial="initial"
                  animate="animate"
                  transition={motionTiming.standard}
                >
                <div
                  className="report-camera-success-title"
                >
                  <CheckCircle2
                    size={22}
                  />
                  <strong>
                    Complaint submitted
                    successfully
                  </strong>
                </div>
                <p
                  className="report-camera-success-copy"
                >
                  Your complaint has been
                  registered with NagarSetu.
                </p>
                <div
                  className="report-camera-complaint-number"
                >
                  <strong>
                    Complaint Number:{' '}
                  </strong>
                  {complaintResult.complaint_number ||
                    complaintResult.complaint_id}
                </div>
                <div
                  className="report-camera-success-meta"
                >
                  Category:{' '}
                  {complaintResult.category}
                </div>
                </motion.div>
              </>
            )}
            {/* RETAKE */}
            {!complaintResult && (
              <button
                type="button"
                onClick={retakePhoto}
                className="report-camera-retake"
              >
                <RotateCcw
                  size={17}
                />
                Retake Photo
              </button>
            )}
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="report-camera-canvas"
        />
      </div>
    </div>
  );
};
export default ReportCamera;
