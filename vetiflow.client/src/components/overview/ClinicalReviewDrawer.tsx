import { CaseReviewDrawer, type ReviewDrawerProps } from "./CaseReviewDrawer";
import { ClinicalReview } from "./ClinicalReview";

// The visit record's Clinical drawer (4.21d); the patient record shows the
// same review as a tab (3.2c).
export function ClinicalReviewDrawer(props: ReviewDrawerProps) {
  return (
    <CaseReviewDrawer {...props} title="Clinical">
      <ClinicalReview detail={props.detail} />
    </CaseReviewDrawer>
  );
}
