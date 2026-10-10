import { useEffect, useState } from "react";

export const useObjectUrl = (blob: Blob): string | undefined => {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    const created = URL.createObjectURL(blob);
    setUrl(created);
    return () => URL.revokeObjectURL(created);
  }, [blob]);
  return url;
};
