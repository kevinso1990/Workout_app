import React, { useEffect } from "react";
import { Route, Switch } from "wouter";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Plans from "./pages/Plans";
import PlanBuilder from "./pages/PlanBuilder";
import ActiveWorkout from "./pages/ActiveWorkout";
import PostWorkout from "./pages/PostWorkout";
import History from "./pages/History";
import SessionDetail from "./pages/SessionDetail";
import Profile from "./pages/Profile";
import Onboarding from "./components/Onboarding";
import { getStoredTheme, applyTheme } from "./lib/theme";

export default function App() {
  useEffect(() => {
    applyTheme(getStoredTheme());
  }, []);

  return (
    <>
      <Onboarding />
      <Switch>
        <Route path="/workout/:sessionId/finish" component={PostWorkout} />
        <Route path="/workout/:sessionId" component={ActiveWorkout} />
        <Route path="/session/:id" component={SessionDetail} />
        <Route>
          <Layout>
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/plans" component={Plans} />
              <Route path="/plans/new" component={PlanBuilder} />
              <Route path="/plans/:id/edit" component={PlanBuilder} />
              <Route path="/history" component={History} />
              <Route path="/profile" component={Profile} />
            </Switch>
          </Layout>
        </Route>
      </Switch>
    </>
  );
}
