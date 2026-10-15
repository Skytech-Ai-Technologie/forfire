import { useEffect, useState, type ReactNode } from 'react'
import { RiskMap } from './RiskMap.tsx'

const SUBMISSION_DEADLINE = '30 novembre 2026 à 23h59 (Africa/Tunis)'

const files = [
  ['train.csv', '816 195', 'oui', 'Contient des imperfections'],
  ['validation.csv', '99 899', 'oui', 'Contient des imperfections'],
  ['test.csv', '99 899', 'non', 'Propre'],
]

const groups = [
  {
    title: 'Identification et position',
    tag: 'POSITION',
    accent: 'blue',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ),
    items: [
      'obs_id : AAAAMMJJ_LLLL_CCCC, unique',
      'date, row (0–593), col (0–1291)',
      'latitude, longitude (WGS84)',
    ],
  },
  {
    title: 'Spectral (Sentinel-2 L2A, 10 m)',
    tag: 'SPECTRAL',
    accent: 'teal',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m12 2 9 5-9 5-9-5 9-5Z" />
        <path d="m3 12 9 5 9-5" />
        <path d="m3 17 9 5 9-5" />
      </svg>
    ),
    items: ['NDVI : végétation', 'NDMI : humidité du combustible', 'NBR : brûlure', 'Tous dans [−1, +1]'],
  },
  {
    title: 'Topographie (SRTM)',
    tag: 'RELIEF',
    accent: 'green',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m8 3 4 8 5-5 5 15H2L8 3Z" />
      </svg>
    ),
    items: ['altitude : 21 à 49 m', 'pente : 0 à 19,84°', 'orientation : 0 à 360°'],
  },
  {
    title: 'Météo (ERA5, 10 h UTC)',
    tag: 'MÉTÉO',
    accent: 'amber',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M17.5 19a4.5 4.5 0 1 0-1.41-8.78 6 6 0 1 0-9.9 6.78" />
        <path d="M3 22h14" />
      </svg>
    ),
    items: [
      't2m_C : 20,8 à 30,8 °C',
      'RH : 47,5 à 85,6 %',
      'wind_speed : 0,83 à 9,56 m/s',
      'wind_dir : 0 à 360°',
      'tp = 0 partout (saison sèche)',
    ],
  },
]

const traps = [
  {
    title: 'Valeurs manquantes',
    text: 'NDVI, NDMI, t2m_C, RH, wind_speed, slope. Choisissez et justifiez une stratégie d’imputation.',
  },
  { title: 'Doublons', text: 'Lignes dupliquées dans train.csv. Appuyez-vous sur obs_id.' },
  {
    title: 'Outliers',
    text: 'Valeurs hors plage physique dans NDVI, t2m_C, wind_speed, altitude. Comparez avec les plages ci-dessus.',
  },
  {
    title: 'Types erronés',
    text: 'Certaines colonnes ont un type incorrect (texte à la place de nombres, par exemple). Convertissez-les.',
  },
]

const steps = [
  ['Explorer', 'Chargez les trois fichiers, vérifiez les types, les distributions, les plages, les dates et la répartition spatiale.'],
  ['Nettoyer train et validation', 'Supprimez la colonne parasite, convertissez les types, retirez les doublons, traitez les outliers hors plage physique, puis imputez les NaN. Documentez chaque choix.'],
  ['Construire des variables', 'Pensez au jour de l’année, à des interactions température/humidité, à la composante du vent selon la pente, ou à des statistiques sur les pixels voisins.'],
  ['Entraîner un modèle de régression', 'Partez d’une référence simple, puis essayez des modèles plus riches (arbres boostés, forêts aléatoires, réseaux).'],
  ['Valider honnêtement', 'Mesurez R², RMSE et MAE sur validation.csv. Attention aux fuites : un même pixel apparaît à plusieurs dates.'],
  ['Prédire sur test.csv', 'Appliquez exactement le même prétraitement. Test est propre, mais les colonnes doivent correspondre. Bornez les prédictions dans [0, 1].'],
  ['Soumettre', 'Générez le fichier de soumission au format ci-dessous.'],
]

const sample = `obs_id,fire_risk
20200818_0387_0982,0.6234
20200823_0100_0500,0.7891
20200828_0250_0750,0.4523`

const python = `test = pd.read_csv("test.csv")
pred = model.predict(X_test).clip(0, 1)
pd.DataFrame({"obs_id": test.obs_id,
  "fire_risk": pred}).to_csv(
  "submission_MonEquipe.csv", index=False)`

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function Reveal({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`reveal ${className}`}>{children}</div>
}

function SubmitModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="submit-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <img
            src={`${import.meta.env.BASE_URL}fire-removebg-preview.png`}
            alt=""
            className="modal-logo"
          />
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>
        <p className="modal-eyebrow">ForFire-AI Challenge</p>
        <h2 id="submit-modal-title">Soumission bientôt disponible</h2>
        <p className="modal-text">
          Le formulaire de soumission sera disponible prochainement. Préparez votre fichier{' '}
          <code>submission_[NomEquipe].csv</code> au format demandé.
        </p>
        <p className="modal-deadline">
          Date limite de clôture du challenge : <strong>{SUBMISSION_DEADLINE}</strong>
        </p>
        <button type="button" className="btn btn-primary modal-cta" onClick={onClose}>
          Compris
        </button>
      </div>
    </div>
  )
}

function DataModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const tomorrow = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(Date.now() + 24 * 60 * 60 * 1000)

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="data-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <img
            src={`${import.meta.env.BASE_URL}fire-removebg-preview.png`}
            alt=""
            className="modal-logo"
          />
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>
        <p className="modal-eyebrow">ForFire-AI Challenge</p>
        <h2 id="data-modal-title">Base de données bientôt disponible</h2>
        <p className="modal-text">
          Demain, la base sera disponible ici : <code>train.csv</code>, <code>validation.csv</code> et{' '}
          <code>test.csv</code> avec leur documentation.
        </p>
        <p className="modal-deadline">
          Disponible dès <strong>{tomorrow}</strong>
        </p>
        <button type="button" className="btn btn-primary modal-cta" onClick={onClose}>
          Compris
        </button>
      </div>
    </div>
  )
}

export function LandingPage() {
  const [submitOpen, setSubmitOpen] = useState(false)
  const [dataOpen, setDataOpen] = useState(false)
  return (
    <div className="challenge">
      <header className="hero-fire">
        <p className="hero-eyebrow text-sm font-semibold uppercase tracking-[0.18em]">ForFire-AI Challenge</p>
        <h1 className="hero-title">
          Lire le feu avant qu’il <span>démarre</span>
        </h1>
        <p className="hero-subtitle mt-5 max-w-2xl text-lg sm:text-xl">
          Un pixel de 10 m, un jour d’été 2020, un peu de météo et de relief : saurez-vous prédire le Fire Ignition
          Index à partir d’images Sentinel-2 ?
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <button type="button" className="btn btn-primary" onClick={() => scrollTo('faire')}>
            Ce que vous devez faire
          </button>
          <button type="button" className="btn btn-quiet" onClick={() => setDataOpen(true)}>
            Voir les données
          </button>
          <button type="button" className="btn btn-gold" onClick={() => setSubmitOpen(true)}>
            Soumettre vos résultats ici
          </button>
        </div>
        <div className="embers" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="hero-visual relative z-10 mt-8">
          <div className="max-w-[480px] flex-1">
            <RiskMap />
          </div>
          <img
            src={`${import.meta.env.BASE_URL}fire-removebg-preview.png`}
            alt="Logo ForFire-AI"
            className="hero-logo-big"
          />
        </div>
      </header>

      <Reveal>
        <section id="objectif" className="challenge-block scroll-mt-24">
          <h2 className="section-banner">L’objectif</h2>
          <p className="lead">
            Prédire <code>fire_risk</code>, un indice normalisé de risque d’incendie compris entre 0 et 1, pour chaque
            pixel du fichier test. C’est un problème de régression supervisée.
          </p>
          <div className="metrics">
            <div>
              <b>R²</b>
              Métrique principale, à maximiser
            </div>
            <div>
              <b>RMSE</b>
              À minimiser
            </div>
            <div>
              <b>MAE</b>
              À minimiser
            </div>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section id="donnees" className="challenge-block scroll-mt-24">
          <h2 className="section-banner">Les données</h2>
          <p className="lead">Une zone de 594 × 1292 pixels, observée à 15 dates entre le 5 mai et le 28 août 2020.</p>
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Fichier</th>
                  <th>Lignes</th>
                  <th>Cible</th>
                  <th>Remarque</th>
                </tr>
              </thead>
              <tbody>
                {files.map(([name, rows, target, note]) => (
                  <tr key={name}>
                    <td>
                      <code>{name}</code>
                    </td>
                    <td>{rows}</td>
                    <td>{target}</td>
                    <td>{note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card-grid">
            {groups.map((group) => (
              <article key={group.title} className={`info-card accent-${group.accent}`}>
                <div className="info-top">
                  <span className="info-icon">{group.icon}</span>
                  <span className="info-tag">{group.tag}</span>
                </div>
                <h3>{group.title}</h3>
                <ul>
                  {group.items.map((item) => {
                    const marker = ' : '
                    const at = item.indexOf(marker)
                    if (at === -1) return <li key={item}><span className="dot" aria-hidden="true" />{item}</li>
                    return (
                      <li key={item}>
                        <span className="dot" aria-hidden="true" />
                        <span>
                          <code>{item.slice(0, at)}</code>
                          {item.slice(at)}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </article>
            ))}
          </div>
          <p className="warn">
            La colonne <code>id_observation</code> est parasite et vide : ignorez-la.
          </p>
        </section>
      </Reveal>

      <Reveal>
        <section id="nettoyage" className="challenge-block scroll-mt-24">
          <h2 className="section-banner">Le piège : des données volontairement sales</h2>
          <p className="lead">
            Train et validation contiennent des imperfections intentionnelles. Le nettoyage est obligatoire, et il fait
            partie de l’évaluation.
          </p>
          <div className="card-grid">
            {traps.map((trap) => (
              <article key={trap.title} className="info-card hot">
                <h3>{trap.title}</h3>
                <p>{trap.text}</p>
              </article>
            ))}
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section id="faire" className="challenge-block scroll-mt-24">
          <h2 className="section-banner">Ce que vous devez faire</h2>
          <p className="lead">Un parcours en sept étapes, de l’exploration à la soumission.</p>
          <ol className="steps">
            {steps.map(([title, text]) => (
              <li key={title}>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </Reveal>

      <Reveal>
        <section id="soumission" className="challenge-block scroll-mt-24">
          <h2 className="section-banner">Format de soumission</h2>
          <p className="lead">
            Fichier nommé <code>submission_[NomEquipe].csv</code>, avec le même nombre de lignes et le même ordre que
            test.csv.
          </p>
          <div className="submit-cta">
            <button type="button" className="btn btn-primary btn-lg" onClick={() => setSubmitOpen(true)}>
              Soumettre vos résultats ici
            </button>
          </div>
          <pre>{sample}</pre>
          <div className="card-grid">
            <article className="info-card">
              <h3>Exigences</h3>
              <ul>
                <li>
                  Colonnes <code>obs_id</code> et <code>fire_risk</code>
                </li>
                <li>99 899 lignes, ordre de test.csv</li>
                <li>Valeurs de fire_risk dans [0, 1]</li>
              </ul>
            </article>
            <article className="info-card">
              <h3>Squelette Python</h3>
              <pre>{python}</pre>
            </article>
          </div>
          <p className="team-line">
            <strong>ForFire-AI Challenge</strong> — 25 septembre 2026
            <br />
            Équipe projet : Sara Charrada, Mehrez Abdellaoui, Ali Douik, Jabli Mohamed Amine (ENISo)
          </p>
        </section>
      </Reveal>
      {submitOpen ? <SubmitModal onClose={() => setSubmitOpen(false)} /> : null}
      {dataOpen ? <DataModal onClose={() => setDataOpen(false)} /> : null}
    </div>
  )
}
