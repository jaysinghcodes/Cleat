"use client";

import { CleatRequestError, listKbArticles, saveKbArticle } from "@cleat/api";
import { aiCopy, categoryLabel, type KbArticle, type KbCategory } from "@cleat/domain";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "../../session";
import { Banner } from "../../ui";

const CATEGORIES: KbCategory[] = ["safety", "faq", "rules"];

export function KnowledgeDesk() {
  const { client } = useSession();
  const [articles, setArticles] = useState<KbArticle[]>([]);
  const [selected, setSelected] = useState<string | "new" | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<KbCategory>("faq");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    if (!client) return;
    const rows = await listKbArticles(client);
    setArticles(rows);
  }, [client]);

  useEffect(() => {
    if (!client) return;
    void load().catch((err: unknown) => {
      setError(err instanceof CleatRequestError ? err.message : aiCopy.loadFailed);
    });
  }, [client, load]);

  function openArticle(article: KbArticle) {
    setSelected(article.id);
    setTitle(article.title);
    setCategory(article.category);
    setBody(article.body);
    setError(null);
    setNotice(null);
  }

  function openNew() {
    setSelected("new");
    setTitle("");
    setCategory("faq");
    setBody("");
    setError(null);
    setNotice(null);
  }

  async function onSave() {
    if (!client || !selected) return;
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      await saveKbArticle(client, window.location.origin, {
        id: selected === "new" ? undefined : selected,
        title,
        category,
        body,
      });
      setNotice(aiCopy.articleSaved);
      await load();
      setSelected(null);
    } catch (err: unknown) {
      setError(err instanceof CleatRequestError ? err.message : aiCopy.articleFailed);
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{aiCopy.knowledgeTitle}</h1>
          <p>{aiCopy.knowledgeLede}</p>
        </div>
        <button type="button" className={selected ? "btn btn-ghost" : "btn btn-primary"} onClick={openNew}>
          {aiCopy.newArticle}
        </button>
      </div>
      {error ? <Banner tone="error">{error}</Banner> : null}
      {notice ? <Banner tone="ok">{notice}</Banner> : null}
      <div className="program-cols">
        <div className="card" style={{ padding: 0 }}>
          {articles.length === 0 ? (
            <div className="list-row">
              <div className="meta">{aiCopy.noArticles}</div>
            </div>
          ) : (
            articles.map((article) => (
              <button
                key={article.id}
                type="button"
                className={selected === article.id ? "list-row article-row active" : "list-row article-row"}
                onClick={() => openArticle(article)}
              >
                <div className="spacer">
                  <div className="name">{article.title}</div>
                  <div className="meta">
                    {categoryLabel(article.category)} · {aiCopy.usedIn} {article.usedIn} {aiCopy.audits}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
        <div className="card">
          {selected ? (
            <form
              className="stack"
              onSubmit={(event) => {
                event.preventDefault();
                void onSave();
              }}
            >
              <div className="field">
                <label htmlFor="kb-title">{aiCopy.articleTitle}</label>
                <input id="kb-title" value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="kb-category">{aiCopy.category}</label>
                <select
                  id="kb-category"
                  value={category}
                  onChange={(event) => setCategory(event.target.value as KbCategory)}
                >
                  {CATEGORIES.map((item) => (
                    <option key={item} value={item}>
                      {categoryLabel(item)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="kb-body">{aiCopy.articleBody}</label>
                <textarea id="kb-body" value={body} maxLength={8000} onChange={(event) => setBody(event.target.value)} />
              </div>
              <p className="meta">{aiCopy.pasteHint}</p>
              <div className="row">
                <button className="btn btn-primary" type="submit" disabled={pending}>
                  {aiCopy.saveArticle}
                </button>
                <button className="btn btn-ghost" type="button" onClick={() => setSelected(null)}>
                  {aiCopy.cancel}
                </button>
              </div>
            </form>
          ) : (
            <p className="meta">{aiCopy.pasteHint}</p>
          )}
        </div>
      </div>
    </div>
  );
}
