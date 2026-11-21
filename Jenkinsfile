pipeline {
    agent any

    environment {
        EC2_HOST = '18.61.154.194'
        EC2_USER = 'ubuntu'
        DEPLOY_PATH = '/var/www/react-app'
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                sh '''
                    node --version
                    npm --version
                    npm ci
                '''
            }
        }

        stage('Test') {
            steps {
                sh 'npm test'
            }
        }

        stage('Lint') {
            steps {
                sh 'npm run lint'
            }
        }

        stage('Build') {
            steps {
                sh 'npm run build'
            }
        }

        stage('Deploy') {
            when {
                branch 'main'
            }

            steps {
                sshagent(credentials: ['ec2-ssh-key']) {

                    sh '''
                        rsync -avz --delete \
                            dist/ \
                            ubuntu@${EC2_HOST}:${DEPLOY_PATH}/

                        ssh ubuntu@${EC2_HOST} \
                            "sudo nginx -t && sudo systemctl reload nginx"
                    '''
                }
            }
        }
    }

    post {
        success {
            echo 'Pipeline completed successfully!'
        }

        failure {
            echo 'Pipeline failed!'
        }

        always {
            echo 'Pipeline execution finished.'
        }
    }
}