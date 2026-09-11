import React from 'react';
import Link from '@docusaurus/Link';
import Head from '@docusaurus/Head';
import styles from './index.module.css';

// Local-only, unbranded switcher for the surviving homepage explorations.
// Delete this file (and index.module.css) once a direction is chosen.

export default function DesignsIndex(): React.ReactElement {
  return (
    <div className={styles.page}>
      <Head>
        <title>Homepage explorations</title>
        <meta name="robots" content="noindex" />
      </Head>
      <h1 className={styles.srOnly}>Homepage explorations</h1>
      <nav className={styles.nav} aria-label="Design explorations">
        <Link to="/designs/studio" className={styles.link}>Studio</Link>
        <Link to="/designs/typographic" className={styles.link}>Verse</Link>
      </nav>
    </div>
  );
}
