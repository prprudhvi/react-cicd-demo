pipeline {

    agent any

    tools {
        nodejs 'nodejs-26'
    }

    environment {
        EC2_HOST = '18.61.154.194'
        EC2_USER = 'ubuntu'

        DEV_DIR = '/var/www/react-app'
        PROD_DIR = '/var/www/react-cicd-demo/prod'
    }

    stages {

        stage('Checkout') {
            steps {
                echo "Building branch: ${env.BRANCH_NAME}"
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm ci'
            }
        }

        stage('Lint') {
            steps {
                sh 'npm run lint'
            }
        }

        stage('Test') {
            steps {
                sh 'npm test'
            }
        }

        stage('Build') {
            steps {
                sh 'npm run build'
            }
        }

        stage('Deploy Dev') {
            when {
                branch 'develop'
            }

            steps {
                echo 'Deploying Development'

                sshagent(credentials: ['ec2-ssh-key']) {
                    sh '''
                        ssh ubuntu@$EC2_HOST \
                            "mkdir -p $DEV_DIR"

                        rsync -avz --delete \
                            -e ssh \
                            dist/ \
                            ubuntu@$EC2_HOST:$DEV_DIR/

                        ssh ubuntu@$EC2_HOST \
                            "sudo nginx -t && sudo systemctl reload nginx"
                    '''
                }
            }
        }

        stage('Deploy Production') {
            when {
                branch 'main'
            }

            steps {
                echo 'Deploying Production'

                sshagent(credentials: ['ec2-ssh-key']) {
                    sh '''
                        ssh ubuntu@$EC2_HOST \
                            "mkdir -p $PROD_DIR"

                        rsync -avz --delete \
                            -e ssh \
                            dist/ \
                            ubuntu@$EC2_HOST:$PROD_DIR/

                        ssh ubuntu@$EC2_HOST \
                            "sudo nginx -t && sudo systemctl reload nginx"
                    '''
                }
            }
        }
    }

    post {
        success {
            echo "Build succeeded for ${env.BRANCH_NAME}"
        }

        failure {
            echo "Build failed for ${env.BRANCH_NAME}"
        }

        always {
            echo "Finished: ${env.BRANCH_NAME}"
        }
    }
}