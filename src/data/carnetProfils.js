// Textes de présentation du carnet de relations, saisis tels que fournis (non reformulés).
// Clé = identifiant du personnage. Les champs absents retombent sur la fiche de characters.json.
// Pour ajouter un profil : copier le bloc de Liam, changer la clé et les textes.
export const PROFILS_CARNET = {
  liam: {
    citation: "Tout le monde connaît son prénom. Personne ne connaît son histoire.",
    age: 21,
    formation: "L2 Communication",
    taille: "1m86",
    poids: "75 kg",
    signe: "Vierge",
    description:
      "Liam a toujours quelque chose à faire et semble parfaitement s'en accommoder. Sérieux sans être froid, discret sans être distant, il préfère les conversations qui ont du sens aux grands discours. Et s'il ne semble pas particulièrement intéressé par les histoires de cœur… ce n'est probablement pas sans raison.",
    modeEmploi: {
      faire: ["Être sincère", "Respecter ses engagements", "Savoir écouter"],
      eviter: ["Attendre qu'il fasse toujours le premier pas", "Être trop curieux", "Jouer au chat et à la souris"],
    },
  },
};