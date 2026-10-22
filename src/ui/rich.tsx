import { Fragment } from 'react';

/** Renders `**bold**` spans in lesson text. */
export function rich(text: string) {
  return text
    .split('**')
    .map((part, k) => (k % 2 ? <b key={k}>{part}</b> : <Fragment key={k}>{part}</Fragment>));
}
