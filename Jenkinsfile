pipeline {

    agent any

    tools {
        nodejs 'nodejs-26'
    } 

    environment {
        EC2_HOST = '18.61.154.194'
        EC2_USER = 'ubuntu'

        DEV_DIR = '/var/www/react-app-dev'
        PROD_DIR = '/var/www/react-app-prod'
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
                bat 'npm ci'
            }
        }

        stage('Lint') {
            steps {
                bat 'npm run lint'
            }
        }

        stage('Test') {
            steps {
                bat 'npm test'
            }
        }

        stage('Build') {
            steps {
                bat 'npm run build'
            }
        }

        stage('Deploy Dev') {
            when {
                branch 'develop'
            }

            steps {
                echo 'Deploying Development'

                sshagent(credentials: ['ec2-ssh-key']) {
                    bat '''
                        ssh -o StrictHostKeyChecking=accept-new %EC2_USER%@%EC2_HOST% "rm -rf /tmp/react-cicd-dev"
                        if errorlevel 1 exit /b 1
                        scp -o StrictHostKeyChecking=accept-new -r dist %EC2_USER%@%EC2_HOST%:/tmp/react-cicd-dev
                        if errorlevel 1 exit /b 1
                        ssh -o StrictHostKeyChecking=accept-new %EC2_USER%@%EC2_HOST% "sudo rm -rf %DEV_DIR% && sudo mkdir -p %DEV_DIR% && sudo cp -a /tmp/react-cicd-dev/. %DEV_DIR%/ && sudo chmod -R a+rX %DEV_DIR% && rm -rf /tmp/react-cicd-dev && sudo nginx -t && sudo systemctl reload nginx"
                        if errorlevel 1 exit /b 1
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
                    bat '''
                        ssh -o StrictHostKeyChecking=accept-new %EC2_USER%@%EC2_HOST% "rm -rf /tmp/react-cicd-prod"
                        if errorlevel 1 exit /b 1
                        scp -o StrictHostKeyChecking=accept-new -r dist %EC2_USER%@%EC2_HOST%:/tmp/react-cicd-prod
                        if errorlevel 1 exit /b 1
                        ssh -o StrictHostKeyChecking=accept-new %EC2_USER%@%EC2_HOST% "sudo rm -rf %PROD_DIR% && sudo mkdir -p %PROD_DIR% && sudo cp -a /tmp/react-cicd-prod/. %PROD_DIR%/ && sudo chmod -R a+rX %PROD_DIR% && rm -rf /tmp/react-cicd-prod && sudo nginx -t && sudo systemctl reload nginx"
                        if errorlevel 1 exit /b 1
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