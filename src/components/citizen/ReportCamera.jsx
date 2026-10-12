import React, {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  Camera,
  MapPin,
  ArrowLeft,
  RotateCcw,
  CheckCircle2,
  Send,
} from 'lucide-react';

import { apiFetch } from '../../api/client';

const ReportCamera = ({
  reportType,
  onBack,
}) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const photoUrlRef = useRef(null);
  const cameraRequestRef = useRef(0);

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
    const requestId = ++cameraRequestRef.current;

    setCameraError('');
    setCameraActive(false);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera is not supported by this browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });

      // Component/request invalid ho chuka hai
      if (requestId !== cameraRequestRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;

      // Optional 1x zoom handling
      const videoTrack = stream.getVideoTracks()[0];

      if (videoTrack?.getCapabilities && videoTrack?.applyConstraints) {
        const capabilities = videoTrack.getCapabilities();

        if (capabilities.zoom) {
          try {
            await videoTrack.applyConstraints({
              advanced: [{ zoom: capabilities.zoom.min }],
            });
          } catch (error) {
            console.warn('Unable to set camera zoom:', error);
          }
        }
      }

      // Request valid raha tabhi camera activate karo
      if (requestId !== cameraRequestRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        return;
      }

      setCameraActive(true);
    } catch (error) {
      // Agar request invalidate ho chuki hai,
      // to user-facing error mat dikhao
      if (requestId !== cameraRequestRef.current) {
        return;
      }

      console.error('Camera error:', error);
      setCameraError(
        error.name === 'NotAllowedError'
          ? 'Camera permission was denied.'
          : 'Unable to access the camera.'
      );
      setCameraActive(false);
    }
  };
  
  const stopCamera = () => {
    // Invalidate any pending camera request
    cameraRequestRef.current += 1;

    if (streamRef.current) {
      streamRef.current
        .getTracks()
        .forEach((track) => track.stop());

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

      if (error.status === 401) {
        setMlError(
          'Your session has expired. Please sign in again.'
        );
      } else {
        setMlError(
          error.message ||
            'Unable to analyze the image.'
        );
      }

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

        const url =URL.createObjectURL(blob);
        photoUrlRef.current = url;

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
    if (photoUrlRef.current) {
      URL.revokeObjectURL(photoUrlRef.current);
      photoUrlRef.current = null;
    }

    setPhoto(null);

    setPrediction(null);
    setConfidence(null);

    setMlError('');

    setDescription('');

    setSubmitError('');
    setComplaintResult(null);

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

      } catch (error) {
        console.error(
          'Complaint submission error:',
          error
        );

        if (error.status === 401) {
          setSubmitError(
            'Your session has expired. Please sign in again.'
          );
        } else if (
          error.status === 422 &&
          error.detail &&
          typeof error.detail === 'object'
        ) {
          setSubmitError(
            error.detail.message ||
              'This image does not match the selected complaint type.'
          );
        } else {
          setSubmitError(
            error.message ||
              'Unable to create complaint.'
          );
        }

      } finally {
        setIsSubmitting(false);
      }
    };
  /* ========================================================
     BACK
     ======================================================== */

  const handleBack = () => {
    stopCamera();

    if (photoUrlRef.current) {
      URL.revokeObjectURL(photoUrlRef.current);
      photoUrlRef.current = null;
    }

    setPhoto(null);
    onBack();
  };
  /* ========================================================
     CLEANUP
     ======================================================== */
  useEffect(() => {
    getLocation();

    return () => {
      // Invalidate pending getUserMedia()
      cameraRequestRef.current += 1;

      if (streamRef.current) {
        streamRef.current
          .getTracks()
          .forEach((track) => track.stop());

        streamRef.current = null;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      if (photoUrlRef.current) {
        URL.revokeObjectURL(photoUrlRef.current);
        photoUrlRef.current = null;
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
        style={{
          maxWidth: '850px',
          width: '100%',
          margin: '0 auto',
        }}
      >
        {/* BACK */}

        <button
          type="button"
          onClick={handleBack}
          style={backStyle}
        >
          <ArrowLeft size={17} />
          Back
        </button>

        {/* HEADER */}

        <h1
          style={{
            marginTop: '18px',
            marginBottom: '8px',
            fontFamily:
              'Fraunces, Georgia, serif',
            color: 'var(--ink)',
          }}
        >
          {title}
        </h1>

        <p
          style={{
            margin: 0,
            color: 'var(--muted)',
            fontSize: '14px',
          }}
        >
          Capture and verify the civic issue.
        </p>

        {/* ==================================================
            LOCATION
            ================================================== */}

        <div
          className="civic-panel"
          style={{
            marginTop: '20px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div
              style={{
                display: 'grid',
                placeItems: 'center',
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: '#e8f0fd',
                color: '#315e63',
              }}
            >
              <MapPin size={21} />
            </div>

            <div>
              <strong
                style={{
                  display: 'block',
                  color: 'var(--ink)',
                  fontSize: '14px',
                }}
              >
                {locationLoading
                  ? 'Getting your location...'
                  : location
                  ? 'Location captured'
                  : 'Location unavailable'}
              </strong>

              {location && (
                <span
                  style={{
                    display: 'block',
                    marginTop: '4px',
                    color: 'var(--muted)',
                    fontSize: '12px',
                  }}
                >
                  {location.latitude.toFixed(6)},{' '}
                  {location.longitude.toFixed(6)}
                </span>
              )}
            </div>
          </div>

          {locationError && (
            <div
              style={{
                marginTop: '14px',
                color: '#b34d3b',
                fontSize: '13px',
              }}
            >
              {locationError}
            </div>
          )}

          {!location &&
            !locationLoading && (
              <button
                type="button"
                onClick={getLocation}
                style={retryStyle}
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
            className="civic-panel"
            style={{
              marginTop: '18px',
            }}
          >
            {!cameraActive ? (
              <div
                style={{
                  padding: '32px 20px',
                  textAlign: 'center',
                }}
              >
                <Camera
                  size={42}
                  style={{
                    marginBottom: '12px',
                    color: '#315e63',
                  }}
                />

                <h3
                  style={{
                    margin:
                      '0 0 7px',
                  }}
                >
                  Take a live photo
                </h3>

                <p
                  style={{
                    margin: 0,
                    color: 'var(--muted)',
                    fontSize: '13px',
                    lineHeight: 1.6,
                  }}
                >
                  Use your camera to capture
                  the civic issue. Gallery
                  uploads are not allowed.
                </p>

                {cameraError && (
                  <div
                    style={{
                      marginTop: '14px',
                      color: '#b34d3b',
                      fontSize: '13px',
                    }}
                  >
                    {cameraError}
                  </div>
                )}

                <button
                  type="button"
                  onClick={startCamera}
                  style={cameraButtonStyle}
                >
                  <Camera size={18} />
                  Open Camera
                </button>
              </div>
            ) : (
              <>
                <div
                  style={{
                    position: 'relative',
                    overflow: 'hidden',
                    borderRadius: '14px',
                    background: '#111',
                  }}
                >
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{
                      display: 'block',
                      width: '100%',
                      maxHeight: '560px',
                      objectFit: 'cover',
                    }}
                  />

                  <span
                    style={{
                      position: 'absolute',
                      top: '14px',
                      right: '14px',
                      padding: '6px 10px',
                      borderRadius: '20px',
                      background:
                        'rgba(0, 0, 0, 0.6)',
                      color: '#fff',
                      fontSize: '12px',
                      fontWeight: 700,
                    }}
                  >
                    1×
                  </span>
                </div>

                <button
                  type="button"
                  onClick={capturePhoto}
                  style={
                    captureButtonStyle
                  }
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
            className="civic-panel"
            style={{
              marginTop: '18px',
            }}
          >
            <p className="civic-eyebrow">
              PHOTO ANALYSIS
            </p>

            <h3
              style={{
                margin:
                  '5px 0 15px',
              }}
            >
              Check your photo
            </h3>

            <img
              src={photo.url}
              alt="Captured civic issue"
              style={{
                display: 'block',
                width: '100%',
                maxHeight: '560px',
                objectFit: 'contain',
                borderRadius: '14px',
                background: '#111',
              }}
            />

            {/* ANALYZING */}

            {isAnalyzing && (
              <div
                style={{
                  marginTop: '18px',
                  padding: '15px',
                  borderRadius: '11px',
                  background: '#f4f1eb',
                  color: 'var(--ink)',
                  textAlign: 'center',
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              >
                Analyzing image with AI...
              </div>
            )}

            {/* ML ERROR */}

            {mlError &&
              !isAnalyzing && (
                <div
                  style={{
                    marginTop: '18px',
                    padding: '14px',
                    borderRadius: '11px',
                    background: '#fce9e5',
                    color: '#a84333',
                    fontSize: '13px',
                  }}
                >
                  {mlError}
                </div>
              )}

            {/* ML RESULT */}

            {prediction &&
              !isAnalyzing &&
              !mlError && (
                <div
                  style={{
                    marginTop: '18px',
                    padding: '18px',
                    borderRadius: '12px',
                    border:
                      '1px solid #e3ddd4',
                    background:
                      '#faf8f3',
                  }}
                >
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      letterSpacing:
                        '1px',
                      color:
                        'var(--muted)',
                    }}
                  >
                    AI DETECTION
                  </div>

                  <div
                    style={{
                      marginTop: '6px',
                      fontSize: '20px',
                      fontWeight: 700,
                      color: isAccepted
                        ? '#397255'
                        : '#a94d38',
                    }}
                  >
                    {prediction}
                  </div>

                  {confidence !==
                    null && (
                    <div
                      style={{
                        marginTop:
                          '5px',
                        color:
                          'var(--muted)',
                        fontSize:
                          '13px',
                      }}
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
                    style={{
                      display: 'flex',
                      alignItems:
                        'center',
                      gap: '7px',
                      marginTop:
                        '13px',
                      paddingTop:
                        '13px',
                      borderTop:
                        '1px solid #e3ddd4',
                      color:
                        isAccepted
                          ? '#397255'
                          : '#a94d38',
                      fontSize:
                        '13px',
                      fontWeight: 600,
                    }}
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
                  style={{
                    marginTop:
                      '20px',
                    paddingTop:
                      '20px',
                    borderTop:
                      '1px solid var(--line)',
                  }}
                >
                  <p className="civic-eyebrow">
                    COMPLAINT DETAILS
                  </p>

                  <label
                    style={{
                      display:
                        'block',
                      marginTop:
                        '10px',
                      marginBottom:
                        '7px',
                      fontSize:
                        '13px',
                      fontWeight: 700,
                      color:
                        'var(--ink)',
                    }}
                  >
                    Description
                    <span
                      style={{
                        color:
                          'var(--muted)',
                        fontWeight: 400,
                      }}
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
                    style={{
                      width: '100%',
                      padding:
                        '12px 13px',
                      border:
                        '1px solid var(--line)',
                      borderRadius:
                        '10px',
                      background:
                        '#fff',
                      color:
                        'var(--ink)',
                      fontFamily:
                        'inherit',
                      fontSize:
                        '13px',
                      resize:
                        'vertical',
                      boxSizing:
                        'border-box',
                    }}
                  />

                  {submitError && (
                    <div
                      style={{
                        marginTop:
                          '13px',
                        padding:
                          '12px',
                        borderRadius:
                          '10px',
                        background:
                          '#fce9e5',
                        color:
                          '#a84333',
                        fontSize:
                          '13px',
                      }}
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
                    style={{
                      ...submitButtonStyle,
                      opacity:
                        isSubmitting
                          ? 0.65
                          : 1,
                    }}
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
              <div
                style={{
                  marginTop:
                    '20px',
                  padding: '20px',
                  borderRadius:
                    '12px',
                  background:
                    '#e8f4ec',
                  border:
                    '1px solid #cde5d4',
                }}
              >
                <div
                  style={{
                    display:
                      'flex',
                    alignItems:
                      'center',
                    gap: '9px',
                    color:
                      '#397255',
                  }}
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
                  style={{
                    margin:
                      '12px 0 0',
                    color:
                      'var(--ink)',
                    fontSize:
                      '13px',
                  }}
                >
                  Your complaint has been
                  registered with NagarSetu.
                </p>

                <div
                  style={{
                    marginTop:
                      '14px',
                    padding:
                      '12px 14px',
                    borderRadius:
                      '9px',
                    background:
                      '#ffffff99',
                    fontSize:
                      '13px',
                  }}
                >
                  <strong>
                    Complaint Number:{' '}
                  </strong>
                  {complaintResult.complaint_number ||
                    complaintResult.complaint_id}
                </div>

                <div
                  style={{
                    marginTop:
                      '8px',
                    color:
                      'var(--muted)',
                    fontSize:
                      '12px',
                  }}
                >
                  Category:{' '}
                  {complaintResult.category}
                </div>
              </div>
            )}

            {/* RETAKE */}

            {!complaintResult && (
              <button
                type="button"
                onClick={retakePhoto}
                style={
                  retakePhotoStyle
                }
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
          style={{
            display: 'none',
          }}
        />
      </div>
    </div>
  );
};

/* ============================================================
   STYLES
   ============================================================ */

const backStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: 0,
  border: 'none',
  background: 'transparent',
  color: 'var(--muted)',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
};

const retryStyle = {
  marginTop: '13px',
  padding: '9px 14px',
  border: 'none',
  borderRadius: '9px',
  background: '#254755',
  color: '#fff',
  fontSize: '12px',
  fontWeight: 700,
  cursor: 'pointer',
};

const cameraButtonStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  marginTop: '18px',
  padding: '12px 20px',
  border: 'none',
  borderRadius: '10px',
  background: '#254755',
  color: '#fff',
  fontSize: '13px',
  fontWeight: 700,
  cursor: 'pointer',
};

const captureButtonStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  width: '100%',
  marginTop: '15px',
  padding: '14px',
  border: 'none',
  borderRadius: '10px',
  background: '#b6533d',
  color: '#fff',
  fontSize: '13px',
  fontWeight: 700,
  cursor: 'pointer',
};

const submitButtonStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  width: '100%',
  marginTop: '15px',
  padding: '14px',
  border: 'none',
  borderRadius: '10px',
  background: '#397255',
  color: '#fff',
  fontSize: '13px',
  fontWeight: 700,
  cursor: 'pointer',
};

const retakePhotoStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '7px',
  marginTop: '15px',
  padding: '11px 16px',
  border: '1px solid var(--line)',
  borderRadius: '10px',
  background: '#fff',
  color: 'var(--ink)',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
};

export default ReportCamera;