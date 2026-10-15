const team = [
  'Sara CHARRADA (ENISo)',
  'Mehrez ABDELLAOUI (ENISo)',
  'Ali DOUIK (ENISo)',
]

const files = [
  { name: 'train.csv', detail: '816 195 lignes, avec fire_risk. Nettoyage obligatoire.' },
  { name: 'validation.csv', detail: '99 899 lignes, avec fire_risk. Nettoyage obligatoire.' },
  { name: 'test.csv', detail: '99 899 lignes, sans fire_risk. Fichier propre.' },
]

const columnGroups: Array<{ title: string; rows: Array<[string, string]> }> = [
  {
    title: 'Identifiant',
    rows: [['obs_id', 'Identifiant unique. Format YYYYMMDD_RRRR_CCCC, stable dans tout le jeu.']],
  },
  {
    title: 'Localisation',
    rows: [
      ['date', 'Date Sentinel-2 (YYYY-MM-DD). 15 dates du 2020-05-05 au 2020-08-28.'],
      ['row', 'Indice ligne du pixel, de 0 à 593.'],
      ['col', 'Indice colonne du pixel, de 0 à 1291.'],
      ['latitude', 'Latitude WGS84, en degrés nord.'],
      ['longitude', 'Longitude WGS84, en degrés est.'],
    ],
  },
  {
    title: 'Données spectrales — Sentinel-2 L2A, 10 m',
    rows: [
      ['NDVI', 'Indice de végétation, dans [−1, +1].'],
      ['NDMI', 'Indice d’humidité du combustible, dans [−1, +1].'],
      ['NBR', 'Indice de brûlure, dans [−1, +1].'],
    ],
  },
  {
    title: 'Données topographiques — SRTM, statiques',
    rows: [
      ['altitude', 'De 21 à 49 m.'],
      ['pente', 'De 0 à 19,84 °.'],
      ['orientation', 'De 0 à 360 °.'],
    ],
  },
  {
    title: 'Données météorologiques — ERA5, 10 h UTC',
    rows: [
      ['t2m_C', 'Température à 2 m, de 20,8 à 30,8 °C.'],
      ['RH', 'Humidité relative, de 47,5 à 85,6 %.'],
      ['wind_speed', 'Vitesse du vent, de 0,83 à 9,56 m/s.'],
      ['wind_dir', 'Direction du vent, de 0 à 360 °.'],
      ['tp', 'Précipitation. Vaut 0 partout : saison sèche.'],
    ],
  },
  {
    title: 'Colonne parasite — à ignorer',
    rows: [['id_observation', 'Identifiant interne. Aucune valeur pour le modèle.']],
  },
  {
    title: 'Cible',
    rows: [['fire_risk', 'Fire Ignition Index, dans [0, 1].']],
  },
]

const flaws = [
  {
    title: 'Valeurs manquantes (NaN)',
    text: 'Colonnes concernées : NDVI, NDMI, t2m_C, RH, wind_speed, slope.',
  },
  { title: 'Doublons', text: 'Des lignes sont dupliquées dans train.csv.' },
  {
    title: 'Valeurs hors plage physique',
    text: 'Colonnes concernées : NDVI, t2m_C, wind_speed, altitude.',
  },
  { title: 'Types incorrects', text: 'Quelques colonnes contiennent des erreurs de type.' },
  { title: 'Colonne parasite', text: 'id_observation est à ignorer.' },
]

export function LandingPage() {
  return (
    <div className="space-y-8">
      <section className="panel overflow-hidden">
        <div className="bg-pine px-6 py-8 text-white sm:px-10 sm:py-10">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#f3c7b4]">ForFire AI Challenge</p>
          <h1 className="mt-3 max-w-3xl font-serif text-4xl leading-[1.05] sm:text-6xl">
            Prédiction du risque d’incendie à partir des données satellites
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-[#e7efe9]">
            Estimer le Fire Ignition Index, <span className="font-semibold text-white">fire_risk</span>, un indice
            normalisé de risque d’incendie dans [0, 1].
          </p>
        </div>
        <div className="grid gap-6 px-6 py-6 sm:grid-cols-[1.2fr_0.8fr] sm:px-10">
          <div>
            <h2 className="font-serif text-2xl">Équipe projet</h2>
            <ul className="mt-3 space-y-1 text-sm">
              {team.map((person) => (
                <li key={person}>{person}</li>
              ))}
            </ul>
          </div>
          <p className="text-sm text-muted sm:text-right">
            <span className="block font-semibold uppercase tracking-[0.14em] text-ember">Date</span>
            <span className="mt-1 block font-serif text-3xl text-ink">25 septembre 2026</span>
          </p>
        </div>
      </section>

      <section id="objectif" className="panel scroll-mt-24 p-6 sm:p-8">
        <h2 className="font-serif text-3xl">Objectif</h2>
        <p className="mt-3 max-w-3xl text-muted">
          Problème de régression supervisée. Le modèle prédit <strong className="text-ink">fire_risk</strong> pour
          chaque observation.
        </p>
        <dl className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-pine-soft px-4 py-4">
            <dt className="text-sm font-semibold uppercase tracking-[0.12em] text-pine">Métrique principale</dt>
            <dd className="mt-1 font-serif text-3xl">R²</dd>
            <dd className="text-sm text-muted">À maximiser</dd>
          </div>
          <div className="rounded-2xl bg-[#fff4f0] px-4 py-4">
            <dt className="text-sm font-semibold uppercase tracking-[0.12em] text-ember">RMSE</dt>
            <dd className="mt-1 font-serif text-3xl">À minimiser</dd>
            <dd className="text-sm text-muted">Métrique secondaire</dd>
          </div>
          <div className="rounded-2xl bg-[#fff4f0] px-4 py-4">
            <dt className="text-sm font-semibold uppercase tracking-[0.12em] text-ember">MAE</dt>
            <dd className="mt-1 font-serif text-3xl">À minimiser</dd>
            <dd className="text-sm text-muted">Métrique secondaire</dd>
          </div>
        </dl>
      </section>

      <section id="fichiers" className="grid scroll-mt-24 gap-4 lg:grid-cols-2">
        <article className="panel p-6 sm:p-8">
          <h2 className="font-serif text-3xl">Fichiers fournis</h2>
          <ul className="mt-4 space-y-4">
            {files.map((file) => (
              <li key={file.name}>
                <p className="font-semibold">{file.name}</p>
                <p className="text-sm text-muted">{file.detail}</p>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-sm">
            <strong>train.csv</strong> et <strong>validation.csv</strong> contiennent volontairement des imperfections.
            Le nettoyage des données est obligatoire. <strong>test.csv</strong> est propre.
          </p>
        </article>
        <article className="panel p-6 sm:p-8">
          <h2 className="font-serif text-3xl">Identifiant unique</h2>
          <p className="mt-3 text-sm leading-6">
            Chaque observation a un <strong>obs_id</strong> au format <code>YYYYMMDD_RRRR_CCCC</code>.
          </p>
          <ul className="mt-3 space-y-1 text-sm text-muted">
            <li>YYYYMMDD — date d’acquisition</li>
            <li>RRRR — indice de ligne (row)</li>
            <li>CCCC — indice de colonne (col)</li>
          </ul>
          <p className="mt-4 rounded-2xl bg-[#f7f3ea] px-4 py-3 font-mono text-sm">
            20200729_0387_0982
            <span className="mt-1 block font-sans text-muted">Pixel (387, 982) le 29 juillet 2020</span>
          </p>
          <p className="mt-4 text-sm">
            Le fichier de soumission contient <strong>obs_id</strong> et <strong>fire_risk</strong> dans le même ordre
            que test.csv.
          </p>
        </article>
      </section>

      <section id="colonnes" className="scroll-mt-24 space-y-4">
        <h2 className="font-serif text-3xl">Description des colonnes</h2>
        {columnGroups.map((group) => (
          <article key={group.title} className="panel overflow-hidden">
            <h3 className="border-b border-line px-5 py-3 font-semibold">{group.title}</h3>
            <table className="w-full text-left text-sm">
              <tbody>
                {group.rows.map(([name, detail]) => (
                  <tr key={name} className="border-t border-line/70 first:border-t-0">
                    <th className="w-36 px-5 py-3 align-top font-mono font-semibold sm:w-44">{name}</th>
                    <td className="px-5 py-3 text-muted">{detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        ))}
      </section>

      <section id="imperfections" className="panel p-6 sm:p-8">
        <h2 className="font-serif text-3xl">Imperfections volontaires</h2>
        <p className="mt-3 max-w-3xl text-sm text-muted">
          Présentes dans train.csv et validation.csv. Le challenge évalue la capacité à les identifier, à nettoyer les
          données, puis à construire un modèle robuste.
        </p>
        <ol className="mt-5 grid gap-3 sm:grid-cols-2">
          {flaws.map((flaw, index) => (
            <li key={flaw.title} className="rounded-2xl border border-line bg-[#fffdf8] px-4 py-4">
              <p className="font-semibold">
                {index + 1}. {flaw.title}
              </p>
              <p className="mt-1 text-sm text-muted">{flaw.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="soumission" className="panel scroll-mt-24 p-6 sm:p-8">
        <h2 className="font-serif text-3xl">Format de soumission</h2>
        <p className="mt-3 text-sm">
          Fichier nommé <strong>submission_[NomEquipe].csv</strong>
        </p>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-muted">
          <li>Colonne obs_id, copiée depuis test.csv</li>
          <li>Colonne fire_risk, prédictions du modèle</li>
          <li>Même nombre de lignes que test.csv</li>
          <li>Même ordre que test.csv</li>
          <li>Valeurs fire_risk dans [0, 1]</li>
        </ul>
        <pre className="mt-5 overflow-x-auto rounded-2xl bg-ink px-4 py-4 text-sm text-[#f7f3ea]">{`obs_id,fire_risk
20200818_0387_0982,0.6234
20200823_0100_0500,0.7891
20200828_0250_0750,0.4523`}</pre>
      </section>
    </div>
  )
}
