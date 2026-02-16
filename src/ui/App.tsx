import { useState } from 'react';
import { Container, Navbar, Nav } from 'react-bootstrap';
import { useUserTeam } from './stores/gameStore';
import MainMenu from './pages/MainMenu';
import GameScreen from './pages/GameScreen';

function App() {
  const currentTeam = useUserTeam();
  const [showGame, setShowGame] = useState(false);

  return (
    <div className="app">
      <Navbar bg="dark" variant="dark" expand="lg">
        <Container>
          <Navbar.Brand href="#home">
            🏈 SIFI NFL
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="me-auto">
              {currentTeam && (
                <>
                  <Nav.Link onClick={() => setShowGame(false)}>Main Menu</Nav.Link>
                  <Navbar.Text className="ms-3">
                    | Managing: <strong>{currentTeam.name}</strong>
                  </Navbar.Text>
                </>
              )}
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      <Container className="main-content py-4">
        {showGame && currentTeam ? (
          <GameScreen onBack={() => setShowGame(false)} />
        ) : (
          <MainMenu onStartGame={() => setShowGame(true)} />
        )}
      </Container>

      <footer className="footer text-center py-3 text-muted">
        <Container>
          <small>SIFI NFL - Sci-Fi American Football Manager</small>
        </Container>
      </footer>
    </div>
  );
}

export default App;
