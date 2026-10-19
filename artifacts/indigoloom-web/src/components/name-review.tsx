import { useState } from 'react';
import { CircleHelp } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetStashYarnReviewsQueryKey, useCreateCatalogReview } from '@workspace/api-client-react';
import type { CatalogField, CatalogReview } from '@workspace/api-client-react';

export const catalogFieldLabels: Record<CatalogField, string> = { brand: 'Brand', sub_brand: 'Sub brand', color: 'Color' };

// The question-mark button beside a stash yarn's names. A maker uses it when
// the catalog merged their name into one that isn't right.
export function NameReviewButton({ field, open, onToggle }: { field: CatalogField; open: boolean; onToggle: () => void }) {
  return <button type="button" className={`name-review-button${open ? ' open' : ''}`} aria-label={`Ask for a review of this ${catalogFieldLabels[field].toLowerCase()} name`} title="Ask for a name review" aria-expanded={open} onClick={onToggle} data-testid={`button-review-${field}`}><CircleHelp size={15}/></button>;
}

export function NameReviewForm({ yarnId, field, currentName, onDone }: { yarnId: string; field: CatalogField; currentName: string; onDone: () => void }) {
  const client = useQueryClient();
  const create = useCreateCatalogReview();
  const [suggestedName, setSuggestedName] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const send = () => {
    if (!suggestedName.trim()) { setError('Enter the name you think it should be.'); return; }
    create.mutate({ data: { stashYarnId: yarnId, field, suggestedName: suggestedName.trim(), note: note.trim() || null } }, {
      onSuccess: () => { void client.invalidateQueries({ queryKey: getGetStashYarnReviewsQueryKey(yarnId) }); onDone(); },
      onError: (failure: unknown) => setError((failure as { data?: { error?: string } })?.data?.error ?? 'We couldn’t send that just now. Please try again.'),
    });
  };
  return <div className="name-review-form" data-testid={`form-review-${field}`}>
    <p>The catalog saved this {catalogFieldLabels[field].toLowerCase()} as <b>{currentName}</b>. What should it be?</p>
    <input aria-label="Name it should be" maxLength={80} value={suggestedName} onChange={(event) => { setSuggestedName(event.target.value); setError(''); }} data-testid={`input-review-name-${field}`}/>
    <textarea aria-label="Anything the reviewer should know" placeholder="Anything the reviewer should know (optional)" rows={2} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} data-testid={`input-review-note-${field}`}/>
    {error && <span className="field-error">{error}</span>}
    <div className="name-review-actions"><button type="button" className="button button-quiet button-small" onClick={onDone}>Cancel</button><button type="button" className="button button-primary button-small" disabled={create.isPending} onClick={send} data-testid={`button-send-review-${field}`}>{create.isPending ? 'Sending…' : 'Ask for a review'}</button></div>
  </div>;
}

const statusLabels: Record<CatalogReview['status'], string> = { open: 'Waiting for review', renamed: 'Renamed', kept: 'Kept as is' };

export function NameReviewList({ reviews }: { reviews: CatalogReview[] }) {
  if (!reviews.length) return null;
  return <ul className="name-review-list" data-testid="list-name-reviews">{reviews.map((review) => <li key={review.id}>
    <span>{catalogFieldLabels[review.field]}: {review.currentName} → {review.suggestedName}</span>
    <b className={`review-status ${review.status}`}>{statusLabels[review.status]}</b>
    {review.reviewerNote && <p>{review.reviewerNote}</p>}
  </li>)}</ul>;
}
