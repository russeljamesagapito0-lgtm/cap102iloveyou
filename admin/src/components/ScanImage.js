import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const BUCKET = 'plant-scans';
const isStoragePath = (p) => !!p && !/^(file|content|https?):/i.test(p);

// Works whether the bucket is public or private: if the scan has a storage path we ask
// for a signed URL (needs the admin storage SELECT policy); otherwise we fall back to
// image_url. Shows `fallback` (placeholder) when there is no image or it fails to load.
export default function ScanImage({ scan, fallback = null }) {
  const [src, setSrc] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setSrc(null);

    const path = scan?.image_path;
    if (isStoragePath(path)) {
      supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, 3600)
        .then(({ data, error }) => {
          if (cancelled) return;
          if (!error && data?.signedUrl) setSrc(data.signedUrl);
          else if (scan?.image_url) setSrc(scan.image_url);
          else setFailed(true);
        });
    } else if (scan?.image_url) {
      setSrc(scan.image_url);
    } else {
      setFailed(true);
    }
    return () => { cancelled = true; };
  }, [scan?.image_path, scan?.image_url]);

  if (!src || failed) return <span className="scan-img-placeholder">{fallback ?? 'No image'}</span>;
  return <img src={src} alt="" className="scan-img" loading="lazy" onError={() => setFailed(true)} />;
}
