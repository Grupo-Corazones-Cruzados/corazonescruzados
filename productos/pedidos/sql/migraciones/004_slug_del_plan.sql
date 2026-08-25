-- El plan se llama «Estándar» pero su código seguía diciendo `esencial`: dos
-- nombres para lo mismo, que es justo lo que confunde al siguiente que lo mire.
-- Se unifica con el del otro producto.
UPDATE "planes" SET "slug" = 'estandar', "actualizado_en" = now() WHERE "slug" = 'esencial';
