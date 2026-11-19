const isAuthor = (user, meta) => Boolean(meta?.author?.id) && meta.author.id === user.id;

export const canCreateThemes = (user, allowed) => Boolean(user.isGM) || allowed.includes(user.id);
export const canEditTheme = (user, meta, allowed) => Boolean(user.isGM) || (canCreateThemes(user, allowed) && isAuthor(user, meta));
export const canSeeTheme = (user, meta) => Boolean(user.isGM) || meta?.visibility === "all" || isAuthor(user, meta);
export const canDeleteTheme = user => Boolean(user.isGM);
