// Pipeline de CI do RotaKids: dependências → testes → build TS → imagem Docker.
pipeline {
    agent any

    stages {
        stage('Instalar dependências') {
            steps {
                dir('rotakids') {
                    sh 'npm ci || npm install'
                }
            }
        }

        stage('Testes unitários') {
            steps {
                dir('rotakids') {
                    sh 'npm test'
                }
            }
        }

        stage('Compilar TypeScript') {
            steps {
                dir('rotakids') {
                    sh 'npm run build'
                }
            }
        }

        stage('Build da imagem Docker') {
            steps {
                dir('rotakids') {
                    sh 'docker build -t rotakids:latest .'
                }
            }
        }
    }

    post {
        success { echo '✅ RotaKids: pipeline concluído com sucesso!' }
        failure { echo '❌ RotaKids: algo falhou — confira os logs acima.' }
    }
}
