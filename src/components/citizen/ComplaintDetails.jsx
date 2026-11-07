import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Loader2,
  MapPin,
  RefreshCw,
  AlertCircle,
  Star,
  Send,
} from 'lucide-react';
import { apiFetch } from '../../api/client';
import { getCategoryMeta } from '../../constants/categories';
import { STATUS_META } from '../../constants/statuses';
import {
  formatDate,
  formatDateTime,
  getPhotoUrl,
} from '../../utils/format';
const ComplaintDetails = ({
  complaintId,
  onBack,
}) => {
  const [complaint, setComplaint] =
    useState(null);
  const [history, setHistory] =
    useState([]);
  const [loading, setLoading] =
    useState(true);
  const [error, setError] =
    useState('');

  const [responseChoice, setResponseChoice] =
    useState('');

  const [responseRating, setResponseRating] =
    useState(0);

  const [responseReview, setResponseReview] =
    useState('');

  const [responseSubmitting, setResponseSubmitting] =
    useState(false);

  const [responseError, setResponseError] =
    useState('');

  const [responseSuccess, setResponseSuccess] =
    useState('');
  const loadComplaint = async () => {
    setLoading(true);
    setError('');
    setResponseError('');
    setResponseSuccess('');
    try {
      const data = await apiFetch(
        `/citizen/complaints/${complaintId}`
      );
      setComplaint(
        data?.complaint || null
      );
      setHistory(
        data?.status_history || []
      );
    } catch (err) {
      setError(
        err?.message ||
          'Unable to load complaint details.'
      );
    } finally {
      setLoading(false);
    }
  };
  const handleSubmitResponse = async () => {
    if (!responseChoice) {
      setResponseError(
        'Please choose whether you are satisfied or want to reopen the complaint.'
      );
      return;
    }

    setResponseSubmitting(true);
    setResponseError('');
    setResponseSuccess('');

    try {
      const data = await apiFetch(
        `/citizen/complaints/${complaintId}/response`,
        {
          method: 'POST',
          body: JSON.stringify({
            response: responseChoice,
            rating:
              responseRating > 0
                ? responseRating
                : null,
            review:
              responseReview.trim() || null,
          }),
        }
      );

      setResponseSuccess(
        data?.message ||
          'Your response was submitted successfully.'
      );

      setResponseChoice('');
      setResponseRating(0);
      setResponseReview('');

      await loadComplaint();
    } catch (err) {
      setResponseError(
        err?.message ||
          'Unable to submit your response.'
      );
    } finally {
      setResponseSubmitting(false);
    }
  };

  useEffect(() => {
    loadComplaint();
  }, [complaintId]);
  if (loading) {
    return (
      <div
        className="civic-dashboard citizen-complaint-loading"
        
      >
        <div
          className="citizen-complaint-loading-content"
        >
          <Loader2
            size={20}
            className="animate-spin"
          />
          Loading complaint...
        </div>
      </div>
    );
  }
  if (error || !complaint) {
    return (
      <div className="civic-dashboard">
        <section
          className="civic-panel citizen-complaint-error-state"
          
        >
          <AlertCircle
            size={38}
            className="citizen-complaint-error-icon"
          />
          <h3>
            Could not load complaint
          </h3>
          <p
            className="citizen-complaint-error-copy"
          >
            {error ||
              'Complaint details not found.'}
          </p>
          <button
            type="button"
            onClick={loadComplaint}
            className="citizen-complaint-retry"
          >
            <RefreshCw size={16} />
            Try again
          </button>
        </section>
      </div>
    );
  }
  const categoryMeta = getCategoryMeta(complaint.category);
  const CategoryIcon =categoryMeta.icon;
  const currentStatus =
    STATUS_META[
      complaint.status
    ] || STATUS_META.received;
  const StatusIcon =
    currentStatus.icon;
  const initialPhoto =
    complaint.photos?.find(
      (photo) =>
        photo.photo_type === 'initial'
    ) || complaint.photos?.[0];
  const photoUrl =
    getPhotoUrl(
      initialPhoto?.photo_url
    );
  const mapsUrl =
    `https://www.google.com/maps?q=${complaint.latitude},${complaint.longitude}`;
  return (
    <div className="civic-dashboard">
      {/* =====================================================
          BACK
      ===================================================== */}
      <button
        type="button"
        onClick={onBack}
        className="citizen-complaint-back"
      >
        <ArrowLeft size={17} />
        Back to My complaints
      </button>
      {/* =====================================================
          HEADER
      ===================================================== */}
      <section className="civic-welcome">
        <div>
          <p className="civic-eyebrow">
            Complaint details
          </p>
          <h2>
            {complaint.title}
          </h2>
          <p>
            {complaint.complaint_number}
          </p>
        </div>
        <span
          className={`citizen-complaint-status citizen-complaint-status-${String(complaint.status || 'received').replace(/_/g, '-')}`}
        >
          <StatusIcon size={16} />
          {currentStatus.label}
        </span>
      </section>
      {/* =====================================================
          PHOTO + BASIC INFO
      ===================================================== */}
      <section
        className="civic-content-grid citizen-complaint-detail-grid"
        
      >
        {/* PHOTO */}
        <article className="civic-panel">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={complaint.title}
              className="citizen-complaint-photo"
            />
          ) : (
            <div
              className="citizen-complaint-photo-empty"
            >
              <CategoryIcon size={54} />
            </div>
          )}
        </article>
        {/* SUMMARY */}
        <article
          className="civic-panel citizen-complaint-panel"
          
        >
          <p className="civic-eyebrow">
            Report summary
          </p>
          <h3
            className="citizen-complaint-section-title"
          >
            Complaint information
          </h3>
          <div
            className="citizen-complaint-info-list"
          >
            <InfoRow
              icon={<CategoryIcon size={17} />}
              label="Category"
              value={
                complaint.category_name ||
                categoryMeta.label
              }
            />
            <InfoRow
              icon={<StatusIcon size={17} />}
              label="Status"
              value={
                currentStatus.label
              }
            />
            <InfoRow
              icon={<Clock3 size={17} />}
              label="Priority"
              value={
                complaint.priority
              }
            />
            <InfoRow
              icon={<CalendarDays size={17} />}
              label="Reported"
              value={
                formatDate(
                  complaint.created_at
                )
              }
            />
          </div>
        </article>
      </section>
      {/* =====================================================
          DESCRIPTION
      ===================================================== */}
      {complaint.description && (
        <section
          className="civic-panel citizen-complaint-panel citizen-complaint-description-panel"
          
        >
          <p className="civic-eyebrow">
            Description
          </p>
          <p
            className="citizen-complaint-description"
          >
            {complaint.description}
          </p>
        </section>
      )}
      {/* =====================================================
          LOCATION
      ===================================================== */}
      <section
        className="civic-panel citizen-complaint-panel citizen-complaint-location-panel"
        
      >
        <div
          className="citizen-complaint-location-header"
        >
          <div>
            <p className="civic-eyebrow">
              Reported location
            </p>
            <h3>
              GPS location
            </h3>
            <p
              className="citizen-complaint-location-note"
            >
              {complaint.latitude},{' '}
              {complaint.longitude}
            </p>
          </div>
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="citizen-complaint-map-link"
          >
            <MapPin size={16} />
            Open in Maps
            <ExternalLink size={14} />
          </a>
        </div>
      </section>
      {/* =====================================================
          CITIZEN RESPONSE
      ===================================================== */}
      {[
        'verified',
        'pending_citizen_response',
      ].includes(complaint.status) && (
        <section
          className="civic-panel citizen-complaint-panel citizen-complaint-response-panel"
          
        >
          <p className="civic-eyebrow">
            Resolution feedback
          </p>

          <h3
            className="citizen-complaint-response-title"
          >
            How was the resolution?
          </h3>

          <p
            className="citizen-complaint-response-note"
          >
            Confirm whether the issue was resolved
            satisfactorily, or reopen the complaint if
            the problem still exists.
          </p>

          {responseError && (
            <div
              className="citizen-complaint-response-error"
            >
              {responseError}
            </div>
          )}

          {responseSuccess && (
            <div
              className="citizen-complaint-response-success"
            >
              {responseSuccess}
            </div>
          )}

          <div
            className="citizen-complaint-response-choices"
          >
            <button
              type="button"
              onClick={() =>
                setResponseChoice('satisfied')
              }
              disabled={responseSubmitting}
              className={`citizen-complaint-choice citizen-complaint-choice-satisfied ${responseChoice === 'satisfied' ? 'is-selected' : ''} ${responseSubmitting ? 'is-disabled' : ''}`}
            >
              <strong
                className="citizen-complaint-choice-title"
              >
                Resolution is satisfactory
              </strong>
              <span
                className="citizen-complaint-choice-copy"
              >
                The issue has been fixed.
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                setResponseChoice('reopen')
              }
              disabled={responseSubmitting}
              className={`citizen-complaint-choice citizen-complaint-choice-reopen ${responseChoice === 'reopen' ? 'is-selected' : ''} ${responseSubmitting ? 'is-disabled' : ''}`}
            >
              <strong
                className="citizen-complaint-choice-title"
              >
                Reopen complaint
              </strong>
              <span
                className="citizen-complaint-choice-copy"
              >
                The issue is not fully resolved.
              </span>
            </button>
          </div>

          {responseChoice === 'satisfied' && (
            <div
              className="citizen-complaint-rating"
            >
              <label
                className="citizen-complaint-field-label"
              >
                Rating
              </label>

              <div
                className="citizen-complaint-rating-group"
              >
                {[1, 2, 3, 4, 5].map(
                  (value) => (
                    <button
                      type="button"
                      key={value}
                      onClick={() =>
                        setResponseRating(value)
                      }
                      disabled={
                        responseSubmitting
                      }
                      aria-label={`Rate ${value} out of 5`}
                      className={`citizen-complaint-rating-star ${value <= responseRating ? 'is-active' : ''} ${responseSubmitting ? 'is-disabled' : ''}`}
                    >
                      <Star
                        size={28}
                        fill={
                          value <= responseRating
                            ? 'currentColor'
                            : 'none'
                        }
                      />
                    </button>
                  )
                )}
              </div>
            </div>
          )}

          <div
            className="citizen-complaint-review"
          >
            <label
              className="citizen-complaint-field-label"
            >
              Review
            </label>

            <textarea
              value={responseReview}
              onChange={(event) =>
                setResponseReview(
                  event.target.value
                )
              }
              disabled={responseSubmitting}
              placeholder={
                responseChoice === 'reopen'
                  ? 'Tell us what is still unresolved...'
                  : 'Share your feedback...'
              }
              rows={4}
              className="citizen-complaint-review-input"
            />
          </div>

          <button
            type="button"
            onClick={handleSubmitResponse}
            disabled={
              responseSubmitting ||
              !responseChoice
            }
            className={`citizen-complaint-submit ${responseSubmitting || !responseChoice ? 'is-disabled' : ''}`}
          >
            {responseSubmitting ? (
              <Loader2
                size={16}
                className="animate-spin"
              />
            ) : (
              <Send size={16} />
            )}

            {responseSubmitting
              ? 'Submitting...'
              : 'Submit response'}
          </button>
        </section>
      )}

      {/* =====================================================
          STATUS HISTORY
      ===================================================== */}
      <section
        className="civic-panel citizen-complaint-panel citizen-complaint-history-panel"
        
      >
        <p className="civic-eyebrow">
          Progress
        </p>
        <h3
          className="citizen-complaint-history-title"
        >
          Status history
        </h3>
        {history.length === 0 ? (
          <p
            className="citizen-complaint-history-note"
          >
            No status updates recorded yet.
          </p>
        ) : (
          <div
            className="citizen-complaint-history-list"
          >
            {history.map(
              (item, index) => {
                const isLast =
                  index ===
                  history.length - 1;
                const status =
                  STATUS_META[
                    item.new_status
                  ] ||
                  STATUS_META.received;
                const HistoryIcon =
                  status.icon;
                return (
                  <div
                    key={item.id}
                    className={`citizen-complaint-history-item ${isLast ? 'is-last' : ''}`}
                  >
                    {/* TIMELINE */}
                    <div
                      className="citizen-complaint-history-rail"
                    >
                      <span
                        className={`citizen-complaint-history-icon citizen-complaint-history-icon-${String(item.new_status || 'received').replace(/_/g, '-')}`}
                      >
                        <HistoryIcon
                          size={15}
                        />
                      </span>
                      {!isLast && (
                        <span
                          className="citizen-complaint-history-connector"
                        />
                      )}
                    </div>
                    {/* EVENT */}
                    <div
                      className="citizen-complaint-history-event"
                    >
                      <div
                        className="citizen-complaint-history-event-head"
                      >
                        <strong>
                          {
                            STATUS_META[status]?.label  ||
                            item.new_status
                          }
                        </strong>
                        <small
                          className="citizen-complaint-history-time"
                        >
                          {formatDateTime(
                            item.changed_at
                          )}
                        </small>
                      </div>
                      {item.old_status && (
                        <p
                          className="citizen-complaint-history-from"
                        >
                          From{' '}
                          {
                            STATUS_META[
                              item.old_status
                            ]?.label ||
                            item.old_status
                          }
                        </p>
                      )}
                      {item.remarks && (
                        <p
                          className="citizen-complaint-history-remarks"
                        >
                          {item.remarks}
                        </p>
                      )}
                    </div>
                  </div>
                );
              }
            )}
          </div>
        )}
      </section>
    </div>
  );
};
const InfoRow = ({
  icon,
  label,
  value,
}) => {
  return (
    <div
      className="citizen-complaint-info-row"
    >
      <span
        className="citizen-complaint-info-icon"
      >
        {icon}
      </span>
      <div>
        <small
          className="citizen-complaint-info-label"
        >
          {label}
        </small>
        <strong>
          {value}
        </strong>
      </div>
    </div>
  );
};
export default ComplaintDetails;
