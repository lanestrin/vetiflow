import { Outlet, Route, Routes } from "react-router-dom";
import { HomeRedirect } from "../components/auth/HomeRedirect";
import { RequireExperience } from "../components/auth/RequireExperience";
import { DemoBar } from "../components/layout/DemoBar";
import { AppShell } from "../components/shell/AppShell";
import { ComingSoonPage } from "../routes/ComingSoonPage";
import { ErBoardPage } from "../routes/ErBoardPage";
import { PetParentHomePage } from "../routes/PetParentHomePage";
import { RecordsPage } from "../routes/RecordsPage";
import { SignInPage } from "../routes/SignInPage";

function App() {
  return (
    <>
      <DemoBar />
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        {/* Every staff page sits inside the Command Center shell (2.10b). */}
        <Route
          element={
            <RequireExperience experience="teamMember">
              {(user) => (
                <AppShell user={user}>
                  <Outlet />
                </AppShell>
              )}
            </RequireExperience>
          }
        >
          <Route path="/er" element={<ErBoardPage />} />
          <Route path="/records" element={<RecordsPage />} />
          <Route path="/overview" element={<ComingSoonPage name="Overview" />} />
          <Route path="/team" element={<ComingSoonPage name="Team" />} />
          <Route path="/reports" element={<ComingSoonPage name="Reports" />} />
          <Route path="/settings" element={<ComingSoonPage name="Settings" />} />
        </Route>
        <Route path="/sign-in" element={<SignInPage />} />
        <Route
          path="/pet-parent"
          element={
            <RequireExperience experience="petParent">
              {(user) => <PetParentHomePage user={user} />}
            </RequireExperience>
          }
        />
      </Routes>
    </>
  );
}

export default App;
