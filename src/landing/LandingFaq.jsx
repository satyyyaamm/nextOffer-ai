import { useEffect, useState } from "react";
import { getLandingFaqItems } from "../help/faqContent";
import { buildFaqSchema, injectJsonLd, removeJsonLd } from "../seo";

const FAQ_ITEMS = getLandingFaqItems(8);

export function LandingFaq() {
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    const schema = buildFaqSchema(
      FAQ_ITEMS.map(({ question, answer }) => ({ question, answer })),
    );
    if (schema) injectJsonLd(schema, "landing-faq");
    return () => removeJsonLd("landing-faq");
  }, []);

  return (
    <section className="lp-faq" id="faq" aria-labelledby="lp-faq-title">
      <div className="lp-container">
        <h2 id="lp-faq-title" className="lp-faq__title">
          Frequently asked questions
        </h2>
        <p className="lp-faq__subtitle">
          How NextOffer.ai works — job search, resume matching, application kits, and Pro plans.
        </p>
        <div className="lp-faq__list">
          {FAQ_ITEMS.map((item) => {
            const open = openId === item.id;
            return (
              <article key={item.id} className="lp-faq__item">
                <h3 className="lp-faq__question-wrap">
                  <button
                    type="button"
                    className="lp-faq__question"
                    aria-expanded={open}
                    onClick={() => setOpenId(open ? null : item.id)}
                  >
                    {item.question}
                    <span className={`lp-faq__chevron${open ? " lp-faq__chevron--open" : ""}`} aria-hidden="true">
                      ▾
                    </span>
                  </button>
                </h3>
                {open && <p className="lp-faq__answer">{item.answer}</p>}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
