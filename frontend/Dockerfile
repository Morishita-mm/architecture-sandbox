FROM node:20-slim

WORKDIR /app

# package.json を先にコピーして install (キャッシュ活用)
COPY package.json package-lock.json* ./
RUN npm install

# ソースコードは volumes でマウントされる
COPY . .

# Viteの開発サーバー起動
# --host 0.0.0.0 をつけないとコンテナ外からアクセスできないので注意
CMD ["npm", "run", "dev", "--", "--host"]