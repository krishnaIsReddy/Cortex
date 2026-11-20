// Shown for any URL that doesn't match a page (see routes.js).
import { Link } from "react-router";
import "../components/layout/layout.css";
import { REPOSITORIES_PATH } from "../routes.js";

export default function NotFoundPage() {
  return (
    <div className="page">
      <header className="page__header">
        <h1 className="page__title">Page not found</h1>
        <p className="page__subtitle">There's nothing at this address.</p>
      </header>
      <p>
        <Link to={REPOSITORIES_PATH} className="button">
          Go to repositories
        </Link>
      </p>
    </div>
  );
}
