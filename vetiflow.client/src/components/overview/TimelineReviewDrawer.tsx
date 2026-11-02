import { CaseReviewDrawer, type ReviewDrawerProps } from "./CaseReviewDrawer";
import { TimelineReview } from "./TimelineReview";

// The visit record's Timeline drawer (4.21d); the patient record shows the
// same review as a tab (3.2c).
export function TimelineReviewDrawer(props: ReviewDrawerProps) {
  return (
    <CaseReviewDrawer {...props} title="Timeline">
      <TimelineReview detail={props.detail} />
    </CaseReviewDrawer>
  );
}
