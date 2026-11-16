import { DialogueEngine, aplatirPersonnages } from "./dialogueEngine.js";
import { normaliserNomJoueur } from "./playerName.js";

// Le passage est copié : ni les données publiées ni la sauvegarde du joueur ne sont utilisées comme état.
export function creerMoteurExtrait(episode, personnages) {
  const parId = aplatirPersonnages(personnages);
  const crushs = new Set(personnages.crushs.filter((p) => p.gauges).map((p) => p.id));
  const parcours = [];
  const visites = new Set();
  let id = episode.start;
  let decor = null;
  let presents = [];
  while (id && !visites.has(id)) {
    visites.add(id);
    const node = episode.nodes[id];
    if (!node) break;
    if (node.background) decor = node.background;
    if (Array.isArray(node.onScreen)) presents = node.onScreen;
    if (node.type === "choice") {
      const interactif = node.options?.some((option) =>
        Object.keys(option.effects || {}).some((personnageId) => crushs.has(personnageId))
      );
      if (!interactif || !presents.some((personnageId) => crushs.has(personnageId))) break;
      const prefixe = parcours.slice(-3);
      const nodes = {};
      prefixe.forEach((entree, index) => {
        nodes[entree.id] = {
          ...structuredClone(entree.node),
          background: entree.decor,
          onScreen: [...entree.presents],
          next: prefixe[index + 1]?.id || id,
        };
      });
      nodes[id] = { ...structuredClone(node), background: decor, onScreen: [...presents] };
      const finId = "__fin_extrait__";
      nodes[finId] = { type: "end" };
      nodes[id].options.forEach((option, index) => {
        const suite = episode.nodes[option.next];
        if (!suite || suite.type !== "line") {
          throw new Error("La réponse de ce choix n'est pas disponible pour l'extrait.");
        }
        const reponseId = `__reponse_extrait_${index}__`;
        nodes[reponseId] = {
          ...structuredClone(suite),
          background: suite.background || decor,
          onScreen: suite.onScreen || [...presents],
          next: finId,
        };
        option.next = reponseId;
      });
      const debut = prefixe[0]?.id || id;
      const gauges = Object.fromEntries([...parId].filter(([, p]) => p.gauges).map(([key, p]) => [key, { ...p.gauges }]));
      return new DialogueEngine({ id: episode.id, start: debut, nodes }, parId, {
        playerName: normaliserNomJoueur(personnages.player.defaultName),
        currentNode: debut,
        currentBackground: decor,
        gauges,
        flags: [],
        completedEpisodes: [],
      }, null, { ephemere: true });
    }
    if (node.type !== "line") break;
    parcours.push({ id, node, decor, presents });
    id = node.next;
  }
  throw new Error("Aucun passage avec choix et lovomètre n'est disponible dans cet épisode.");
}
