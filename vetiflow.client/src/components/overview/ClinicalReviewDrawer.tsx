import { CaseReviewDrawer, type ReviewDrawerProps } from "./CaseReviewDrawer";
import { ClinicalReview } from "./ClinicalReview";

// The visit record's Clinical drawer (4.21d); the patient record's Clinical
// tab shows the same two parts in disclosures (3.2e).
export function ClinicalReviewDrawer(props: ReviewDrawerProps) {
  return (
    <CaseReviewDrawer {...props} title="Clinical">
      <ClinicalReview detail={props.detail} />
    </CaseReviewDrawer>
  );
}
