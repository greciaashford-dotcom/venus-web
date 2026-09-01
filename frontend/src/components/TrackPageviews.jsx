import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { captureAcquisition, trackPageview } from "../lib/tracking";

// Invisible component: records first-touch acquisition + a pageview per route change.
export default function TrackPageviews() {
  const loc = useLocation();

  useEffect(() => {
    captureAcquisition();
  }, []);

  useEffect(() => {
    trackPageview(loc.pathname);
  }, [loc.pathname]);

  return null;
}
