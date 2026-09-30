if (Number(process.versions.node.split('.')[0]) < 22) {
  console.error('Нужен Node.js 22 или новее и npm 10+. Выполните nvm use перед запуском.'); process.exit(1)
}
